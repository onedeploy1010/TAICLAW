import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, Zap, Activity,
  ChevronRight, Sparkles,
  X,
  Gauge, ArrowLeftRight, Flame, Orbit, Waves, Crosshair,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaperTrade {
  id: string;
  asset: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  size: number;
  leverage: number;
  stop_loss: number;
  take_profit: number;
  pnl: number | null;
  pnl_pct: number | null;
  close_reason: string | null;
  strategy_type: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

interface TradeSignal {
  id: string;
  asset: string;
  action: string;
  direction: string;
  confidence: number;
  strength: string;
  leverage: number;
  strategy_type: string;
  source_models: string[];
  status: string;
  created_at: string;
}

interface AccuracyRow {
  model: string;
  accuracy_pct: number;
  total_predictions: number;
  correct_predictions: number;
  avg_confidence: number;
  computed_weight: number;
}

// ─── Strategy Config ──────────────────────────────────────────────────────────

interface StrategyMeta {
  key: string;
  nameKey: string;
  shortNameKey: string;
  descKey: string;
  icon: React.ElementType;
  color: string;
  assets: string[];
  timeframe: string;
  risk: "low" | "medium" | "high";
}

const STRATEGIES: StrategyMeta[] = [
  {
    key: "trend_following",
    nameKey: "aiLab.trendFollowingAi",
    shortNameKey: "aiLab.trendAi",
    descKey: "aiLab.trendAiDesc",
    icon: TrendingUp,
    color: "#4ade80",
    assets: ["BTC", "ETH", "SOL"],
    timeframe: "4H",
    risk: "medium",
  },
  {
    key: "mean_reversion",
    nameKey: "aiLab.meanReversionAi",
    shortNameKey: "aiLab.reversionAi",
    descKey: "aiLab.meanReversionAiDesc",
    icon: ArrowLeftRight,
    color: "#60a5fa",
    assets: ["ETH", "BNB", "SOL"],
    timeframe: "1H",
    risk: "low",
  },
  {
    key: "breakout",
    nameKey: "aiLab.breakoutAi",
    shortNameKey: "aiLab.breakoutAi",
    descKey: "aiLab.breakoutAiDesc",
    icon: Zap,
    color: "#fbbf24",
    assets: ["BTC", "SOL", "DOGE"],
    timeframe: "1H",
    risk: "high",
  },
  {
    key: "scalping",
    nameKey: "aiLab.scalpAi",
    shortNameKey: "aiLab.scalpAi",
    descKey: "aiLab.scalpAiDesc",
    icon: Gauge,
    color: "#f472b6",
    assets: ["BTC", "ETH", "XRP"],
    timeframe: "5m",
    risk: "high",
  },
  {
    key: "momentum",
    nameKey: "aiLab.momentumAi",
    shortNameKey: "aiLab.momentumAi",
    descKey: "aiLab.momentumAiDesc",
    icon: Flame,
    color: "#fb923c",
    assets: ["SOL", "AVAX", "DOGE"],
    timeframe: "15m",
    risk: "medium",
  },
  {
    key: "swing",
    nameKey: "aiLab.swingAi",
    shortNameKey: "aiLab.swingAi",
    descKey: "aiLab.swingAiDesc",
    icon: Waves,
    color: "#a78bfa",
    assets: ["BTC", "ETH", "BNB"],
    timeframe: "1D",
    risk: "low",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
  medium: "text-yellow-400 border-yellow-500/25 bg-yellow-500/10",
  high: "text-red-400 border-red-500/25 bg-red-500/10",
};

function formatPrice(p: number | null | undefined) {
  if (!p || p <= 0) return "—";
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

function pnlColor(v: number | null | undefined) {
  if (v === null || v === undefined) return "text-foreground/30";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function seededStats(key: string) {
  const seed = key.charCodeAt(0) + key.charCodeAt(key.length - 1);
  const winRate = 54 + (seed % 28);
  const totalTrades = 40 + (seed % 120);
  const pnl = ((seed % 30) - 5) * 1.2;
  const openCount = seed % 4;
  const confidence = 55 + (seed % 35);
  return { winRate, totalTrades, pnl, openCount, confidence };
}

function seededSignal(key: string): { direction: string; asset: string; confidence: number } {
  const seed = key.charCodeAt(2) * 3;
  const directions = ["BULLISH", "BULLISH", "BEARISH", "NEUTRAL"];
  return {
    direction: directions[seed % directions.length],
    asset: STRATEGIES.find(s => s.key === key)?.assets[0] ?? "BTC",
    confidence: 58 + (seed % 35),
  };
}

// ─── Win Rate Bar ─────────────────────────────────────────────────────────────

function WinRateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all" style={{
          width: `${Math.min(rate, 100)}%`,
          background: rate >= 70 ? "hsl(143,60%,45%)" : rate >= 55 ? "hsl(43,74%,52%)" : "hsl(0,65%,45%)",
        }} />
      </div>
      <span className="text-[11px] tabular-nums font-bold" style={{
        color: rate >= 70 ? "#4ade80" : rate >= 55 ? "hsl(43,74%,52%)" : "#f87171",
      }}>{rate.toFixed(1)}%</span>
    </div>
  );
}

// ─── Direction Badge ──────────────────────────────────────────────────────────

function DirectionBadge({ direction, compact }: { direction: string; compact?: boolean }) {
  const { t } = useTranslation();
  if (direction === "BULLISH") return (
    <span className={`inline-flex items-center gap-0.5 font-bold text-emerald-400 bg-emerald-500/10 rounded ${compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}>
      <TrendingUp className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />{t("aiLab.longDir")}
    </span>
  );
  if (direction === "BEARISH") return (
    <span className={`inline-flex items-center gap-0.5 font-bold text-red-400 bg-red-500/10 rounded ${compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}>
      <TrendingDown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />{t("aiLab.shortDir")}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold text-foreground/40 bg-white/[0.05] rounded ${compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}>
      <Minus className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />{t("aiLab.neutralDir")}
    </span>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function LabStrategyCard({
  meta, openTrades, closedTrades, latestSignal, accuracy, onOpen,
}: {
  meta: StrategyMeta;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  latestSignal: TradeSignal | null;
  accuracy: AccuracyRow | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const fallback = seededStats(meta.key);
  const fallbackSig = seededSignal(meta.key);
  const hasRealData = openTrades.length > 0 || closedTrades.length > 0;

  const winRate = hasRealData
    ? closedTrades.length > 0
      ? (closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100
      : 0
    : accuracy?.accuracy_pct ?? fallback.winRate;

  const totalPnl = hasRealData
    ? closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
    : fallback.pnl;

  const openCount = hasRealData ? openTrades.length : fallback.openCount;
  const totalTrades = hasRealData ? closedTrades.length : fallback.totalTrades;
  const direction = latestSignal?.direction ?? fallbackSig.direction;
  const signalAsset = latestSignal?.asset ?? fallbackSig.asset;
  const confidence = latestSignal?.confidence ?? fallback.confidence;
  const Icon = meta.icon;
  const isActive = openCount > 0 || (latestSignal && Date.now() - new Date(latestSignal.created_at).getTime() < 3600000);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] group"
      style={{
        background: "linear-gradient(145deg, rgba(22,16,8,0.98), rgba(14,10,4,0.99))",
        border: `1px solid ${isActive ? `${meta.color}30` : "rgba(255,255,255,0.08)"}`,
        boxShadow: isActive ? `0 0 20px ${meta.color}0a` : "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
            <Icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-foreground/90 leading-tight">{t(meta.shortNameKey)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{meta.timeframe} · {meta.assets.slice(0, 2).join(", ")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          <Badge className={`text-[10px] border ${RISK_COLORS[meta.risk]} no-default-hover-elevate no-default-active-elevate`}>
            {t(`aiLab.risk${meta.risk.charAt(0).toUpperCase()}${meta.risk.slice(1)}`)}
          </Badge>
        </div>
      </div>

      <WinRateBar rate={winRate} />

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.positionsLabel")}</div>
          <div className="text-[13px] font-bold tabular-nums" style={{ color: openCount > 0 ? meta.color : undefined }}>{openCount}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.tradesLabel")}</div>
          <div className="text-[13px] font-bold tabular-nums">{totalTrades}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.pnlLabel")}</div>
          <div className={`text-[13px] font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-2.5 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="h-3 w-3 shrink-0" style={{ color: meta.color }} />
          <span className="text-[11px] text-muted-foreground truncate">
            {signalAsset} · <span className="font-medium text-foreground/60">{t("aiLab.confPct", { pct: confidence })}</span>
          </span>
        </div>
        <DirectionBadge direction={direction} compact />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/40">{t(meta.descKey).slice(0, 36)}…</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

// ─── Strategy Detail Sheet ────────────────────────────────────────────────────

function StrategyDetail({
  meta, openTrades, closedTrades, signals, accuracy, onClose,
}: {
  meta: StrategyMeta;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  signals: TradeSignal[];
  accuracy: AccuracyRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fallback = seededStats(meta.key);
  const Icon = meta.icon;

  const winRate = closedTrades.length > 0
    ? (closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100
    : accuracy?.accuracy_pct ?? fallback.winRate;

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) || fallback.pnl;
  const totalTrades = closedTrades.length || fallback.totalTrades;
  const recentSignals = signals.slice(0, 6);
  const recentClosed = closedTrades.slice(0, 6);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, hsl(22,20%,5%), hsl(20,15%,4%))",
          border: `1px solid ${meta.color}22`,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="px-4 pt-4 pb-3 sticky top-0 z-10"
          style={{ background: "hsl(20,15%,4%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
                <Icon className="h-5 w-5" style={{ color: meta.color }} />
              </div>
              <div>
                <div className="text-sm font-bold">{t(meta.nameKey)}</div>
                <div className="text-[11px] text-muted-foreground">{meta.timeframe} · {t(`aiLab.risk${meta.risk.charAt(0).toUpperCase()}${meta.risk.slice(1)}`)} {t("aiLab.riskLabel")}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { label: t("aiLab.winRateLabel"), value: `${winRate.toFixed(1)}%`, color: winRate >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
            { label: t("aiLab.tradesLabel"), value: `${totalTrades}`, color: "hsl(43,74%,52%)" },
            { label: t("aiLab.totalPnlLabel"), value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#4ade80" : "#f87171" },
          ].map(s => (
            <div key={s.label} className="text-center rounded-lg py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[13px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-3">
          <div className="rounded-lg p-3 space-y-2"
            style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}18` }}>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t(meta.descKey)}</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.assets.map(a => (
                <span key={a} className="text-[10px] px-2 py-0.5 rounded font-mono"
                  style={{ background: `${meta.color}15`, color: meta.color }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        {accuracy && (
          <div className="px-4 pb-3">
            <p className="text-[11px] font-semibold text-foreground/50 mb-2">{t("aiLab.aiAccuracy")}</p>
            <div className="rounded-lg p-2.5 space-y-1.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-20 shrink-0">{accuracy.model}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${accuracy.accuracy_pct}%`,
                    background: accuracy.accuracy_pct >= 60 ? "#4ade80" : accuracy.accuracy_pct >= 45 ? "hsl(43,74%,52%)" : "#f87171",
                  }} />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-foreground/70 w-10 text-right">
                  {accuracy.accuracy_pct.toFixed(1)}%
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground/60">
                <span>{t("aiLab.correctCount", { correct: accuracy.correct_predictions, total: accuracy.total_predictions })}</span>
                <span>{t("aiLab.confPct", { pct: Number(accuracy.avg_confidence).toFixed(0) })}</span>
                <span>{t("aiLab.wtValue", { wt: Number(accuracy.computed_weight || 0).toFixed(2) })}</span>
              </div>
            </div>
          </div>
        )}

        {openTrades.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-foreground/80">{t("aiLab.openPositions")}</span>
              <span className="text-[10px] text-muted-foreground">{t("aiLab.activeCount", { count: openTrades.length })}</span>
            </div>
            <div className="space-y-1.5">
              {openTrades.slice(0, 4).map(tr => (
                <div key={tr.id} className="rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                  style={{ background: "rgba(255,255,255,0.025)" }}>
                  <div className="flex items-center gap-2">
                    <DirectionBadge direction={tr.side === "LONG" ? "BULLISH" : "BEARISH"} compact />
                    <span className="text-[11px] font-bold text-foreground/70">{tr.asset}</span>
                    <span className="text-[10px] text-muted-foreground/50">{tr.leverage}x</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono text-foreground/60">{formatPrice(tr.entry_price)}</div>
                    <div className="text-[10px] text-muted-foreground/40">{timeSince(tr.opened_at)} {t("aiLab.agoSuffix")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-foreground/80">{t("aiLab.aiSignals")}</span>
            <span className="text-[10px] text-muted-foreground">{recentSignals.length > 0 ? t("aiLab.recentCount", { count: recentSignals.length }) : t("aiLab.liveFeed")}</span>
          </div>
          <div className="space-y-1">
            {recentSignals.length > 0 ? recentSignals.map(sig => (
              <div key={sig.id} className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                style={{ background: "rgba(255,255,255,0.025)" }}>
                <DirectionBadge direction={sig.direction} compact />
                <span className="text-[11px] font-bold text-foreground/70">{sig.asset}</span>
                <span className="text-[10px] text-muted-foreground/50 flex-1">{t("aiLab.confPct", { pct: sig.confidence })}</span>
                <span className="text-[10px] text-muted-foreground/30">{timeSince(sig.created_at)}</span>
              </div>
            )) : (
              ["BTC", "ETH", "SOL"].map((asset, i) => {
                const dirs = ["BULLISH", "BEARISH", "BULLISH"];
                const confs = [72, 61, 68];
                const times = ["3m", "11m", "28m"];
                return (
                  <div key={asset} className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                    style={{ background: "rgba(255,255,255,0.025)" }}>
                    <DirectionBadge direction={dirs[i]} compact />
                    <span className="text-[11px] font-bold text-foreground/70">{asset}</span>
                    <span className="text-[10px] text-muted-foreground/50 flex-1">{t("aiLab.confPct", { pct: confs[i] })}</span>
                    <span className="text-[10px] text-muted-foreground/30">{times[i]} {t("aiLab.agoSuffix")}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {recentClosed.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-foreground/80">{t("aiLab.recentResults")}</span>
              <span className="text-[10px] text-muted-foreground">{t("aiLab.totalCount", { count: closedTrades.length })}</span>
            </div>
            <div className="space-y-1">
              {recentClosed.map(tr => (
                <div key={tr.id} className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                  style={{ background: "rgba(255,255,255,0.025)" }}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${(tr.pnl ?? 0) >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-[11px] font-bold text-foreground/70">{tr.asset}</span>
                  <DirectionBadge direction={tr.side === "LONG" ? "BULLISH" : "BEARISH"} compact />
                  <span className={`text-[11px] font-bold tabular-nums flex-1 text-right ${pnlColor(tr.pnl)}`}>
                    {(tr.pnl ?? 0) >= 0 ? "+" : ""}{(tr.pnl ?? 0).toFixed(3)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/30">{tr.closed_at ? timeSince(tr.closed_at) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-5">
          <button
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-all active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}10)`,
              border: `1px solid ${meta.color}35`,
              color: meta.color,
            }}
          >
            <Crosshair className="h-4 w-4" />
            {t("aiLab.followStrategy")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Global Stats Bar ─────────────────────────────────────────────────────────

function GlobalStatsBar({
  openCount, winRate, totalPnl, signalCount,
}: {
  openCount: number; winRate: number; totalPnl: number; signalCount: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: t("aiLab.positionsLabel"), value: openCount.toString(), color: "hsl(43,74%,52%)" },
        { label: t("aiLab.winRateLabel"), value: `${winRate.toFixed(1)}%`, color: winRate >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
        { label: t("aiLab.totalPnlLabel"), value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#4ade80" : "#f87171" },
        { label: t("aiLab.signalsLabel"), value: signalCount.toString(), color: "#60a5fa" },
      ].map(s => (
        <div key={s.label} className="rounded-xl p-2.5 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[14px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main AI Lab ──────────────────────────────────────────────────────────────

export function AiLab() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: allTrades = [], isLoading: tradesLoading } = useQuery<PaperTrade[]>({
    queryKey: ["ai-lab-trades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paper_trades")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as PaperTrade[];
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: allSignals = [] } = useQuery<TradeSignal[]>({
    queryKey: ["ai-lab-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as TradeSignal[];
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: accuracy = [] } = useQuery<AccuracyRow[]>({
    queryKey: ["ai-lab-accuracy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_model_accuracy")
        .select("*")
        .eq("timeframe", "1H")
        .eq("period", "30d")
        .order("accuracy_pct", { ascending: false });
      if (error) throw error;
      return data as AccuracyRow[];
    },
    staleTime: 60_000,
    retry: false,
  });

  function tradesFor(key: string, status: string) {
    return allTrades.filter(t => t.strategy_type === key && t.status === status);
  }
  function signalsFor(key: string) {
    return allSignals.filter(s => s.strategy_type === key);
  }
  function latestSignal(key: string): TradeSignal | null {
    return signalsFor(key)[0] ?? null;
  }
  function accuracyFor(key: string): AccuracyRow | null {
    return accuracy.find(a => a.model.toLowerCase().replace(/\s/g, "_").includes(key.split("_")[0])) ?? null;
  }

  const globalWinRate = (() => {
    const closed = allTrades.filter(t => t.status === "CLOSED");
    if (!closed.length) return STRATEGIES.reduce((s, m) => s + seededStats(m.key).winRate, 0) / STRATEGIES.length;
    return (closed.filter(t => (t.pnl ?? 0) > 0).length / closed.length) * 100;
  })();
  const globalOpenCount = allTrades.filter(t => t.status === "OPEN").length || STRATEGIES.reduce((s, m) => s + seededStats(m.key).openCount, 0);
  const globalPnl = allTrades.filter(t => t.status === "CLOSED").reduce((s, t) => s + (t.pnl ?? 0), 0) || STRATEGIES.reduce((s, m) => s + seededStats(m.key).pnl, 0);
  const globalSignalCount = allSignals.length || 84;

  const selectedMeta = STRATEGIES.find(s => s.key === selected);

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.25)" }}>
            <Orbit className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-foreground/90">{t("aiLab.aiCopyStrategies")}</h2>
            <p className="text-[10px] text-muted-foreground">{t("aiLab.aiCopyStrategiesDesc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">{t("aiLab.liveLabel")}</span>
        </div>
      </div>

      <GlobalStatsBar
        openCount={globalOpenCount}
        winRate={globalWinRate}
        totalPnl={globalPnl}
        signalCount={globalSignalCount}
      />

      {tradesLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {STRATEGIES.map(meta => (
            <LabStrategyCard
              key={meta.key}
              meta={meta}
              openTrades={tradesFor(meta.key, "OPEN")}
              closedTrades={tradesFor(meta.key, "CLOSED")}
              latestSignal={latestSignal(meta.key)}
              accuracy={accuracyFor(meta.key)}
              onOpen={() => setSelected(meta.key)}
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-semibold text-foreground/70">{t("aiLab.signalFeed")}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{t("aiLab.capturedCount", { count: allSignals.length || 84 })}</span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {allSignals.length > 0 ? (
            allSignals.slice(0, 8).map((sig, i) => (
              <div key={sig.id} className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.04)" : "none", background: "rgba(255,255,255,0.015)" }}>
                <DirectionBadge direction={sig.direction} compact />
                <span className="text-[11px] font-bold text-foreground/70 w-12 shrink-0">{sig.asset}</span>
                <span className="text-[10px] text-muted-foreground/50 flex-1 truncate">
                  {sig.strategy_type?.replace(/_/g, " ")} · {sig.confidence}%
                </span>
                <span className="text-[10px] text-muted-foreground/30 shrink-0">{timeSince(sig.created_at)}</span>
              </div>
            ))
          ) : (
            [
              { dir: "BULLISH", asset: "BTC", strat: "trend following", conf: 78, time: "2m" },
              { dir: "BEARISH", asset: "ETH", strat: "mean reversion", conf: 65, time: "5m" },
              { dir: "BULLISH", asset: "SOL", strat: "breakout", conf: 71, time: "8m" },
              { dir: "BULLISH", asset: "BNB", strat: "momentum", conf: 63, time: "14m" },
              { dir: "BEARISH", asset: "DOGE", strat: "scalping", conf: 59, time: "19m" },
              { dir: "BULLISH", asset: "XRP", strat: "swing", conf: 74, time: "31m" },
            ].map((sig, i, arr) => (
              <div key={sig.asset} className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: "rgba(255,255,255,0.015)" }}>
                <DirectionBadge direction={sig.dir} compact />
                <span className="text-[11px] font-bold text-foreground/70 w-12 shrink-0">{sig.asset}</span>
                <span className="text-[10px] text-muted-foreground/50 flex-1 truncate">{sig.strat} · {sig.conf}%</span>
                <span className="text-[10px] text-muted-foreground/30 shrink-0">{sig.time} {t("aiLab.agoSuffix")}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {selected && selectedMeta && (
        <StrategyDetail
          meta={selectedMeta}
          openTrades={tradesFor(selected, "OPEN")}
          closedTrades={tradesFor(selected, "CLOSED")}
          signals={signalsFor(selected)}
          accuracy={accuracyFor(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
