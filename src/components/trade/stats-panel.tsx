import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface TradeStats {
  total: number;
  wins: number;
  losses: number;
  totalStaked: string;
}

interface StatsPanelProps {
  stats: TradeStats;
  isLoading: boolean;
}

function useCountUp(target: number, duration: number = 800): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    if (target === 0 && start === 0) return;

    const startTime = performance.now();
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

export function StatsPanel({ stats, isLoading }: StatsPanelProps) {
  const { t } = useTranslation();
  const totalAnim = useCountUp(stats.total);
  const winsAnim = useCountUp(stats.wins);
  const lossesAnim = useCountUp(stats.losses);
  const staked = parseFloat(stats.totalStaked || "0");

  const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0.0";

  if (isLoading) {
    return (
      <div>
        <div className="h-16 animate-pulse rounded bg-muted/20" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[15px] font-bold text-foreground mb-3">
        {t("trade.myStats")}
      </h3>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-lg font-bold text-foreground tabular-nums font-mono" data-testid="text-total-bets">{totalAnim}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{t("trade.totalBets")}</div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums font-mono" data-testid="text-win-loss">
            <span className="text-foreground">{winsAnim}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-foreground">{lossesAnim}</span>
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{t("trade.wl")}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-foreground tabular-nums font-mono" data-testid="text-win-rate">{winRate}%</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{t("trade.winRate")}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-foreground tabular-nums font-mono" data-testid="text-total-staked">{staked.toFixed(0)}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{t("trade.staked")}</div>
        </div>
      </div>
    </div>
  );
}
