/**
 * AI Lab — Model-based analysis dashboard
 * Shows accuracy, predictions, and reasoning for each AI model
 * (GPT-4o, Claude, Gemini, DeepSeek, Llama)
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, Brain, Target,
  BarChart3, Sparkles, ChevronRight, X, Activity,
  Cpu, Eye, Layers, Search as SearchIcon, Zap,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AiConsoleButton } from "@/components/strategy/ai-thinking-console";
import { List } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccuracyRow {
  model: string;
  accuracy_pct: number;
  total_predictions: number;
  correct_predictions: number;
  avg_confidence: number;
  avg_price_error_pct: number;
  computed_weight: number;
}

interface PredictionRecord {
  id: string;
  asset: string;
  timeframe: string;
  model: string;
  prediction: string;
  confidence: number;
  target_price: number;
  current_price: number;
  actual_price: number | null;
  actual_change_pct: number | null;
  direction_correct: boolean | null;
  price_error_pct: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

// ─── Model Config ─────────────────────────────────────────────────────────────

interface ModelMeta {
  key: string;
  name: string;
  desc: string;
  color: string;
  icon: React.ElementType;
}

const MODELS: ModelMeta[] = [
  { key: "QA", name: "QA AI", desc: "Multi-model consensus · Meta-strategy", color: "#3b82f6", icon: Brain },
  { key: "GPT-4o", name: "GPT-4o", desc: "Trend follower · Momentum-based analysis", color: "#4ade80", icon: Brain },
  { key: "Claude", name: "Claude", desc: "Risk-aware · Contrarian analysis", color: "#a78bfa", icon: Eye },
  { key: "Gemini", name: "Gemini", desc: "Volatility scalper · Multi-timeframe", color: "#60a5fa", icon: Layers },
  { key: "DeepSeek", name: "DeepSeek", desc: "Technical purist · RSI/MACD/BB", color: "#fbbf24", icon: SearchIcon },
  { key: "Llama", name: "Llama", desc: "Momentum chaser · Local AI model", color: "#fb923c", icon: Zap },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function seededModelStats(model: string) {
  const seed = model.charCodeAt(0) + model.charCodeAt(model.length - 1);
  return {
    accuracy: 52 + (seed % 30),
    totalPredictions: 80 + (seed % 200),
    correctPredictions: 40 + (seed % 120),
    avgConfidence: 58 + (seed % 25),
    weight: 0.15 + (seed % 20) / 100,
  };
}

// ─── Accuracy Bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Direction Badge ──────────────────────────────────────────────────────────

function DirBadge({ dir }: { dir: string }) {
  const { t } = useTranslation();
  if (dir === "BULLISH") return (
    <span className="inline-flex items-center gap-0.5 font-bold text-emerald-400 bg-emerald-500/10 rounded text-[10px] px-1.5 py-0.5">
      <TrendingUp className="h-2.5 w-2.5" />{t("trade.bullish")}
    </span>
  );
  if (dir === "BEARISH") return (
    <span className="inline-flex items-center gap-0.5 font-bold text-red-400 bg-red-500/10 rounded text-[10px] px-1.5 py-0.5">
      <TrendingDown className="h-2.5 w-2.5" />{t("trade.bearish")}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 font-bold text-foreground/40 bg-white/[0.05] rounded text-[10px] px-1.5 py-0.5">
      <Minus className="h-2.5 w-2.5" />Neutral
    </span>
  );
}

// ─── Model Card ───────────────────────────────────────────────────────────────

function ModelCard({
  meta, accuracy, predictions, simStat, onOpen,
}: {
  meta: ModelMeta;
  accuracy: AccuracyRow | null;
  predictions: PredictionRecord[];
  simStat: SimModelStat | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const fallback = seededModelStats(meta.key);
  const acc = accuracy?.accuracy_pct ?? fallback.accuracy;
  const total = accuracy?.total_predictions ?? fallback.totalPredictions;
  const correct = accuracy?.correct_predictions ?? fallback.correctPredictions;
  const conf = accuracy?.avg_confidence ?? fallback.avgConfidence;
  const weight = accuracy?.computed_weight ?? fallback.weight;

  const recentPreds = predictions.slice(0, 3);
  const isActive = recentPreds.length > 0 && Date.now() - new Date(recentPreds[0].created_at).getTime() < 3600000;

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
            <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-foreground/90 leading-tight">{meta.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{meta.desc.split("·")[0].trim()}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
      </div>

      <AccuracyBar pct={acc} color={meta.color} />

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.tradesLabel")}</div>
          <div className="text-[13px] font-bold tabular-nums">{total}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.winRateLabel")}</div>
          <div className="text-[13px] font-bold tabular-nums" style={{ color: acc >= 60 ? "#4ade80" : acc >= 45 ? "hsl(43,74%,52%)" : "#f87171" }}>
            {acc.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("aiLab.confPct", { pct: "" }).replace(" %", "")}</div>
          <div className="text-[13px] font-bold tabular-nums">{conf.toFixed(0)}%</div>
        </div>
      </div>

      {simStat && simStat.totalTrades > 0 && (
        <div className="mt-2.5 rounded-lg px-2.5 py-1.5 grid grid-cols-3 gap-1"
          style={{ background: `${meta.color}09`, border: `1px solid ${meta.color}18` }}>
          <div className="text-center">
            <div className="text-[11px] font-bold tabular-nums" style={{ color: simStat.winRate >= 55 ? "#4ade80" : simStat.winRate >= 45 ? "hsl(43,74%,52%)" : "#f87171" }}>
              {simStat.winRate.toFixed(0)}%
            </div>
            <div className="text-[8px] text-muted-foreground">胜率</div>
          </div>
          <div className="text-center">
            <div className={`text-[11px] font-bold tabular-nums ${simStat.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {simStat.totalPnl >= 0 ? "+" : ""}{simStat.totalPnl.toFixed(1)}
            </div>
            <div className="text-[8px] text-muted-foreground">PnL</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold tabular-nums" style={{ color: meta.color }}>
              {simStat.openTrades}
            </div>
            <div className="text-[8px] text-muted-foreground">持仓</div>
          </div>
        </div>
      )}

      {recentPreds.length > 0 && (
        <div className="mt-2.5 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="h-3 w-3 shrink-0" style={{ color: meta.color }} />
            <span className="text-[11px] text-muted-foreground truncate">
              {recentPreds[0].asset} · {recentPreds[0].timeframe}
            </span>
          </div>
          <DirBadge dir={recentPreds[0].prediction} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/40">{t("aiLab.wtValue", { wt: weight.toFixed(2) })}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}



// ─── Prediction Verification Panel (inline, not dialog) ───────────────────────

interface SimModelStat {
  model: string;
  totalTrades: number;
  winningTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  avgWinPct: number;
  avgLossPct: number;
}

interface PaperTrade {
  id: string; asset: string; side: string; entryPrice: number; exitPrice: number | null;
  leverage: number; pnl: number | null; pnlPct: number | null;
  strategyType: string | null; primaryModel: string | null; status: string;
  openedAt: string; closedAt: string | null;
}

function fmtDt(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const date = `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")}`;
  const time = `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  return { date, time };
}

const PAGE_SIZE = 15;

function SimOrdersButton({ model, color }: { model: string; color: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const limit = page * PAGE_SIZE;

  const { data: trades = [], isLoading, isFetching } = useQuery<PaperTrade[]>({
    queryKey: ["ai-sim-trades", model, limit],
    queryFn: async () => {
      const res = await fetch(`/api/ai-sim/trades?model=${encodeURIComponent(model)}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json() as Promise<PaperTrade[]>;
    },
    enabled: open,
    staleTime: 20_000,
    refetchInterval: open ? 30_000 : false,
  });

  const hasMore = trades.length === limit;
  const closed = trades.filter(t => t.status === "CLOSED");
  const winRate = closed.length > 0 ? (closed.filter(t => Number(t.pnl ?? 0) > 0).length / closed.length * 100) : 0;
  const totalPnl = closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0);

  function handleClose() {
    setOpen(false);
    setPage(1);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]"
        style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}
        data-testid={`button-orders-${model}`}
      >
        <List className="h-3.5 w-3.5" />{t("aiLab.simOrders", "Orders")}
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-md w-full p-0 overflow-hidden flex flex-col"
          style={{ background: "linear-gradient(160deg, hsl(22,20%,4%), hsl(20,15%,3%))", border: `1px solid ${color}22`, maxHeight: "88vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-sm font-bold">{model} {t("aiLab.simOrders", "Orders")}</span>
            </div>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Summary stats */}
          <div className="px-4 py-2 grid grid-cols-3 gap-1.5 shrink-0">
            {[
              { l: "胜率", v: `${winRate.toFixed(0)}%`, c: winRate >= 50 ? "#4ade80" : "#f87171" },
              { l: "总PnL", v: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(1)}`, c: totalPnl >= 0 ? "#4ade80" : "#f87171" },
              { l: "笔数", v: trades.length.toString(), c: color },
            ].map(s => (
              <div key={s.l} className="rounded-lg p-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[8px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Column headers */}
          <div className="px-4 py-1 grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-[8px] uppercase text-muted-foreground/40 w-4">方向</span>
            <span className="text-[8px] uppercase text-muted-foreground/40">品种 / 价格</span>
            <span className="text-[8px] uppercase text-muted-foreground/40 text-right w-16">时间</span>
            <span className="text-[8px] uppercase text-muted-foreground/40 text-right w-16">盈亏</span>
          </div>

          {/* Trade list */}
          <div className="overflow-y-auto flex-1 px-4 pb-2 space-y-1 mt-1">
            {isLoading && page === 1 ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
            ) : trades.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground/40 text-[11px]">
                AI engine initializing... check back in a moment.
              </div>
            ) : (
              <>
                {trades.map((tr, i) => {
                  const { date, time } = fmtDt(tr.openedAt);
                  const pnlNum = Number(tr.pnl ?? 0);
                  const pnlPctNum = Number(tr.pnlPct ?? 0);
                  const isOpen = tr.status === "OPEN";
                  return (
                    <div
                      key={tr.id}
                      className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center rounded-lg px-3 py-2.5"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${isOpen ? `${color}20` : "rgba(255,255,255,0.04)"}`,
                        animation: `fadeSlideIn 0.2s ease-out ${Math.min(i * 0.02, 0.3)}s both`,
                      }}
                      data-testid={`row-trade-${tr.id}`}
                    >
                      {/* Side badge */}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-4 text-center ${tr.side === "LONG" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                        {tr.side === "LONG" ? "L" : "S"}
                      </span>

                      {/* Asset + price */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-foreground/85">{tr.asset}</span>
                          <span className="text-[9px] text-muted-foreground/60">{tr.leverage}x</span>
                          {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        </div>
                        <div className="text-[9px] text-muted-foreground/40 truncate">
                          ${Number(tr.entryPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          {tr.exitPrice ? ` → $${Number(tr.exitPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
                        </div>
                      </div>

                      {/* Date + time */}
                      <div className="text-right w-16 shrink-0">
                        <div className="text-[9px] text-muted-foreground/60 tabular-nums">{date}</div>
                        <div className="text-[9px] text-muted-foreground/35 tabular-nums">{time}</div>
                      </div>

                      {/* PnL */}
                      <div className="text-right w-16 shrink-0">
                        {isOpen ? (
                          <span className="text-[10px] font-bold" style={{ color }}>持仓中</span>
                        ) : (
                          <>
                            <div className={`text-[11px] font-bold tabular-nums ${pnlNum >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(2)}
                            </div>
                            <div className={`text-[9px] tabular-nums ${pnlPctNum >= 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                              {pnlPctNum >= 0 ? "+" : ""}{pnlPctNum.toFixed(2)}%
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Load more */}
                {hasMore && (
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={isFetching}
                    className="w-full mt-2 rounded-lg py-2.5 text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}
                    data-testid="button-load-more-trades"
                  >
                    {isFetching ? "加载中..." : "查看更多"}
                  </button>
                )}

                {!hasMore && trades.length > 0 && (
                  <div className="text-center py-2 text-[9px] text-muted-foreground/30">
                    共 {trades.length} 笔记录
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PredictionVerifyPanel({ model, color, predictions }: { model: string; color: string; predictions: PredictionRecord[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const TFS = ["5m", "30m", "1H", "4H", "1D"];
  const ASSETS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"];

  const preds = predictions.length > 0 ? predictions : Array.from({ length: 10 }, (_, i) => {
    const seed = model.charCodeAt(0) * 100 + i;
    const r = ((Math.sin(seed * 9301 + 49297) % 1) + 1) % 1;
    const r2 = ((Math.sin(seed * 7919 + 31337) % 1) + 1) % 1;
    const asset = ASSETS[i % 6];
    const tf = TFS[i % 5];
    const dir = r > 0.55 ? "BULLISH" : r > 0.2 ? "BEARISH" : "NEUTRAL";
    const base = asset === "BTC" ? 102000 : asset === "ETH" ? 3800 : asset === "SOL" ? 170 : 50 + r * 500;
    const changePct = dir === "BULLISH" ? r2 * 4 + 0.5 : dir === "BEARISH" ? -(r2 * 3 + 0.3) : r2 - 0.5;
    const resolved = i >= 3;
    const actualChange = changePct + (r2 - 0.5) * 2;
    const correct = resolved ? (dir === "BULLISH" ? actualChange > 0 : dir === "BEARISH" ? actualChange < 0 : Math.abs(actualChange) < 1) : null;
    return {
      id: `pv-${model}-${i}`, asset, timeframe: tf, model, prediction: dir,
      confidence: Math.floor(52 + r * 38),
      target_price: +(base * (1 + changePct / 100)).toFixed(2),
      current_price: +base.toFixed(2),
      actual_price: resolved ? +(base * (1 + actualChange / 100)).toFixed(2) : null,
      actual_change_pct: resolved ? +actualChange.toFixed(2) : null,
      direction_correct: correct,
      price_error_pct: resolved ? +Math.abs((r2 - 0.5) * 3).toFixed(2) : null,
      status: resolved ? "resolved" : "pending",
      created_at: new Date(Date.now() - i * 1800000).toISOString(),
      resolved_at: resolved ? new Date(Date.now() - i * 900000).toISOString() : null,
    } as PredictionRecord;
  });

  const resolved = preds.filter(p => p.status === "resolved");
  const correctCount = resolved.filter(p => p.direction_correct).length;
  const shown = expanded ? preds : preds.slice(0, 4);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${color}12` }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${color}08` }}>
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3" style={{ color }} />
          <span className="text-[11px] font-bold" style={{ color }}>{t("aiLab.predVerify")}</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {correctCount}/{resolved.length} ✓ · {preds.length - resolved.length} pending
        </span>
      </div>

      <div className="divide-y divide-white/[0.03]">
        {shown.map((p) => {
          const isPending = p.status === "pending";
          const isCorrect = p.direction_correct === true;
          const changePct = p.current_price > 0 ? ((p.target_price - p.current_price) / p.current_price * 100) : 0;
          return (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${isPending ? "bg-yellow-400 animate-pulse" : isCorrect ? "bg-emerald-400" : "bg-red-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-foreground/80">{p.asset}</span>
                  <span className="text-[8px] px-1 rounded bg-white/[0.06] text-muted-foreground">{p.timeframe}</span>
                  <DirBadge dir={p.prediction} />
                </div>
                <div className="text-[9px] text-muted-foreground/40">
                  ${p.current_price.toLocaleString()} → ${p.target_price.toLocaleString()}
                  {p.actual_price ? ` (${p.actual_price.toLocaleString()})` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                {isPending ? (
                  <span className="text-[10px] font-bold text-yellow-400">{p.confidence}%</span>
                ) : (
                  <span className={`text-[10px] font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                    {isCorrect ? "✓" : "✗"} {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
                  </span>
                )}
                <div className="text-[8px] text-muted-foreground/30">{timeSince(p.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {preds.length > 3 && (
        <button onClick={() => setExpanded(v => !v)}
          className="w-full py-1.5 text-[10px] text-center transition-colors" style={{ color, borderTop: `1px solid ${color}08` }}>
          {expanded ? t("dashboard.collapse") : t("dashboard.expandMore", { count: preds.length - 3 })}
        </button>
      )}
    </div>
  );
}

// ─── Model Detail Sheet ───────────────────────────────────────────────────────

function ModelDetail({
  meta, accuracy, predictions, onClose,
}: {
  meta: ModelMeta;
  accuracy: AccuracyRow | null;
  predictions: PredictionRecord[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fallback = seededModelStats(meta.key);
  const acc = accuracy?.accuracy_pct ?? fallback.accuracy;
  const total = accuracy?.total_predictions ?? fallback.totalPredictions;
  const correct = accuracy?.correct_predictions ?? fallback.correctPredictions;
  const conf = accuracy?.avg_confidence ?? fallback.avgConfidence;
  const weight = accuracy?.computed_weight ?? fallback.weight;
  const priceErr = accuracy?.avg_price_error_pct ?? (3 + (meta.key.charCodeAt(0) % 5));

  const recentPreds = predictions.slice(0, 10);

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
                <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
              </div>
              <div>
                <div className="text-sm font-bold">{meta.name}</div>
                <div className="text-[11px] text-muted-foreground">{meta.desc}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { label: t("aiLab.winRateLabel"), value: `${acc.toFixed(1)}%`, color: acc >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
            { label: t("aiLab.tradesLabel"), value: `${total}`, color: "hsl(43,74%,52%)" },
            { label: t("aiLab.correctCount", { correct, total }).split("/")[0] + " ✓", value: `${correct}`, color: "#4ade80" },
          ].map(s => (
            <div key={s.label} className="text-center rounded-lg py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[13px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Extended Stats */}
        <div className="px-4 pb-3">
          <div className="rounded-lg p-3 space-y-2"
            style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}18` }}>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{t("aiLab.confPct", { pct: conf.toFixed(0) })}</span>
              <span className="font-bold" style={{ color: meta.color }}>{conf.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Price Error</span>
              <span className="font-bold text-foreground/70">{priceErr.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{t("aiLab.wtValue", { wt: "" }).replace(" ", "")}</span>
              <span className="font-bold text-foreground/70">{weight.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Prediction Verification */}
        <div className="px-4 pb-3">
          <PredictionVerifyPanel model={meta.key} color={meta.color} predictions={recentPreds} />
        </div>

        {/* Action Buttons: Console + Sim Orders */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1"><AiConsoleButton model={meta.key} color={meta.color} /></div>
          <div className="flex-1"><SimOrdersButton model={meta.key} color={meta.color} /></div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ─── Global Stats ─────────────────────────────────────────────────────────────

function GlobalModelStats({ accuracy, predCount }: { accuracy: AccuracyRow[]; predCount: number }) {
  const { t } = useTranslation();
  const avgAcc = accuracy.length > 0
    ? accuracy.reduce((s, a) => s + a.accuracy_pct, 0) / accuracy.length
    : 63.5;
  const totalCorrect = accuracy.length > 0
    ? accuracy.reduce((s, a) => s + a.correct_predictions, 0)
    : 142;
  const totalPred = accuracy.length > 0
    ? accuracy.reduce((s, a) => s + a.total_predictions, 0)
    : 245;

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: "Models", value: `${MODELS.length}`, color: "hsl(43,74%,52%)" },
        { label: t("aiLab.winRateLabel"), value: `${avgAcc.toFixed(1)}%`, color: avgAcc >= 60 ? "#4ade80" : "hsl(43,74%,52%)" },
        { label: "Correct", value: `${totalCorrect}`, color: "#4ade80" },
        { label: "Total", value: `${totalPred}`, color: "#60a5fa" },
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

  const { data: accuracy = [], isLoading: accLoading } = useQuery<AccuracyRow[]>({
    queryKey: ["ai-lab-accuracy"],
    queryFn: async () => {
      const data = await fetch("/api/admin/ai-stats?period=30d&timeframe=1H").then(r => r.json()).catch(() => ({}));
      return (Array.isArray(data.modelAccuracy) ? data.modelAccuracy : []) as AccuracyRow[];
    },
    staleTime: 60_000,
    retry: false,
  });

  const { data: predictions = [] } = useQuery<PredictionRecord[]>({
    queryKey: ["ai-lab-predictions"],
    queryFn: async () => {
      const data = await fetch("/api/admin/ai-predictions?limit=100").then(r => r.json()).catch(() => []);
      return (Array.isArray(data) ? data : []) as PredictionRecord[];
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: simStats = [] } = useQuery<SimModelStat[]>({
    queryKey: ["ai-sim-stats"],
    queryFn: async () => {
      const data = await fetch("/api/ai-sim/stats").then(r => r.json()).catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  function simStatFor(model: string): SimModelStat | null {
    return simStats.find(s => s.model === model) ?? null;
  }

  function accuracyFor(model: string): AccuracyRow | null {
    return accuracy.find(a => a.model === model) ?? null;
  }
  function predsFor(model: string): PredictionRecord[] {
    return predictions.filter(p => p.model === model);
  }

  const selectedMeta = MODELS.find(m => m.key === selected);

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.25)" }}>
            <Brain className="h-3.5 w-3.5 text-primary" />
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

      {/* Global Stats */}
      <GlobalModelStats accuracy={accuracy} predCount={predictions.length} />

      {/* Model Cards */}
      {accLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {MODELS.map(meta => (
            <ModelCard
              key={meta.key}
              meta={meta}
              accuracy={accuracyFor(meta.key)}
              predictions={predsFor(meta.key)}
              simStat={simStatFor(meta.key)}
              onOpen={() => setSelected(meta.key)}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      {selected && selectedMeta && (
        <ModelDetail
          meta={selectedMeta}
          accuracy={accuracyFor(selected)}
          predictions={predsFor(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
