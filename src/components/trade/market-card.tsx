import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiBitcoin, SiEthereum } from "react-icons/si";
import type { PredictionMarket } from "@shared/types";

function AssetIcon({ asset }: { asset: string }) {
  switch (asset) {
    case "BTC":
      return <SiBitcoin className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />;
    case "ETH":
      return <SiEthereum className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />;
    default:
      return (
        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 shrink-0">
          <span className="text-[12px] font-bold text-primary">{asset[0]}</span>
        </div>
      );
  }
}

interface MarketCardProps {
  market: PredictionMarket;
}

export function MarketCard({ market }: MarketCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="border-border bg-card" data-testid={`market-${market.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AssetIcon asset={market.asset} />
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">
              {market.expiresAt
                ? new Date(market.expiresAt).toLocaleString()
                : ""}{" "}
              {market.asset} price &gt; __?
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {market.targetPrice1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neon-value">{market.yesOdds}%</span>
                  <Button size="sm" className="h-6 text-[12px] bg-primary/20 text-primary">
                    {t("common.yes")}
                  </Button>
                  <Button size="sm" className="h-6 text-[12px] bg-red-500/20 text-red-400">
                    {t("common.no")}
                  </Button>
                </div>
              </div>
              {market.targetPrice2 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {market.targetPrice2}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">{market.noOdds}%</span>
                    <Button size="sm" className="h-6 text-[12px] bg-primary/20 text-primary">
                      {t("common.yes")}
                    </Button>
                    <Button size="sm" className="h-6 text-[12px] bg-red-500/20 text-red-400">
                      {t("common.no")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="mt-2 text-[12px] no-default-hover-elevate no-default-active-elevate">
              {market.asset}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
