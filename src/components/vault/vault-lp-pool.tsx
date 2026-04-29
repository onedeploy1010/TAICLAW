import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Flame, BarChart2, TrendingUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface PoolStats {
  mother: {
    usdtTotal: string;
    runeTotal: string;
    lockPositions: number;
    nodeCount: number;
  };
  sub: {
    usdtTotal: string;
    runeTotal: string;
    burnPositions: number;
  };
  tradingPool: {
    balance: string;
  };
  isLive: boolean;
}

type PoolView = "mother" | "sub";

function fmtUsdt(val: string | number) {
  const n = Number(val);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtRune(val: string | number) {
  const n = Number(val);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export function VaultLpPool() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";
  const [view, setView] = useState<PoolView>("mother");

  const { data, isLoading } = useQuery<PoolStats>({
    queryKey: ["/api/vault/pool-stats"],
    queryFn: () => fetch("/api/vault/pool-stats").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const isLive = data?.isLive ?? false;

  const motherAccent = "rgba(212,168,50,0.9)";
  const subAccent    = "rgba(239,100,60,0.9)";
  const accent       = view === "mother" ? motherAccent : subAccent;

  const poolData = view === "mother" ? data?.mother : data?.sub;

  return (
    <div
      className="relative mx-4 lg:mx-6 rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(14,14,22,0.95), rgba(10,10,16,0.98))",
        border: `1px solid ${accent}28`,
        boxShadow: `0 0 32px ${accent}10`,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute left-0 right-0 top-0 h-[1.5px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent} 70%, transparent 100%)`,
          opacity: 0.7,
        }}
      />

      {/* HUD corner brackets */}
      {[
        "top-1.5 left-1.5 border-t border-l rounded-tl",
        "top-1.5 right-1.5 border-t border-r rounded-tr",
        "bottom-1.5 left-1.5 border-b border-l rounded-bl",
        "bottom-1.5 right-1.5 border-b border-r rounded-br",
      ].map((cls, i) => (
        <span
          key={i}
          className={`absolute w-2.5 h-2.5 pointer-events-none ${cls}`}
          style={{ borderColor: accent, opacity: 0.5 }}
        />
      ))}

      {/* Diagonal scan line */}
      <div
        className="absolute inset-y-0 -left-full w-1/2 pointer-events-none animate-scan-pool"
        style={{
          background: "linear-gradient(115deg, transparent 0%, transparent 40%, rgba(255,255,255,0.018) 50%, transparent 60%, transparent 100%)",
        }}
      />

      <style>{`
        @keyframes scanPool {
          from { transform: translateX(0%); }
          to   { transform: translateX(400%); }
        }
        .animate-scan-pool { animation: scanPool 9s linear infinite; }
        @keyframes breathe { 0%,100% { opacity:0.45; transform:scale(1); } 50% { opacity:0; transform:scale(2.5); } }
        .dot-breathe { animation: breathe 2.2s ease-in-out infinite; }
      `}</style>

      <div className="relative z-10 px-4 py-3 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
            >
              <Layers className="h-3.5 w-3.5" style={{ color: accent }} />
            </div>
            <div>
              <div className="text-[11px] font-bold leading-tight" style={{ color: accent }}>
                {isZh ? "底池沉淀" : "LP Pool Accumulation"}
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight">
                {isZh ? "节点入金 · 链上底池" : "Node Deposits · On-chain Liquidity"}
              </div>
            </div>
          </div>

          {/* Live / pre-launch badge */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="dot-breathe absolute inline-flex h-full w-full rounded-full"
                style={{ background: isLive ? "rgb(34,197,94)" : accent }}
              />
              <span
                className="relative inline-flex h-full w-full rounded-full"
                style={{ background: isLive ? "rgb(34,197,94)" : accent }}
              />
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: isLive ? "rgb(34,197,94)" : accent }}
            >
              {isLive
                ? (isZh ? "实时LP" : "Live LP")
                : (isZh ? "节点沉淀" : "Pre-launch")}
            </span>
          </div>
        </div>

        {/* Toggle: Mother / Sub */}
        <div className="flex gap-1.5">
          {([
            { key: "mother" as const, icon: TrendingUp, labelZh: "母币底池", labelEn: "Mother LP", accent: motherAccent },
            { key: "sub"    as const, icon: Flame,      labelZh: "子币底池", labelEn: "Sub LP",    accent: subAccent },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                view === tab.key ? "opacity-100" : "opacity-45 hover:opacity-65"
              )}
              style={view === tab.key ? {
                background: `${tab.accent}18`,
                border: `1px solid ${tab.accent}35`,
                color: tab.accent,
              } : {
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.5)",
              }}
              data-testid={`button-vault-pool-${tab.key}`}
            >
              <tab.icon className="h-3 w-3" />
              {isZh ? tab.labelZh : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Main pool stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* USDT Total */}
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: `${accent}08`, border: `1px solid ${accent}18` }}
            >
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                {isZh ? "USDT 沉淀" : "USDT Deposited"}
              </div>
              <div className="text-xl font-bold tabular-nums" style={{ color: accent }}>
                {fmtUsdt(poolData?.usdtTotal ?? 0)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {view === "mother"
                  ? (isZh ? `${data?.mother.nodeCount ?? 0} 节点 + ${data?.mother.lockPositions ?? 0} 锁仓` : `${data?.mother.nodeCount ?? 0} nodes · ${data?.mother.lockPositions ?? 0} locks`)
                  : (isZh ? `${data?.sub.burnPositions ?? 0} 销毁仓位` : `${data?.sub.burnPositions ?? 0} burn positions`)}
              </div>
            </div>

            {/* RUNE equivalent */}
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                {view === "mother"
                  ? (isZh ? "母币数量" : "RUNE Locked")
                  : (isZh ? "销毁母币" : "RUNE Burned")}
              </div>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {fmtRune(poolData?.runeTotal ?? 0)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                RUNE
              </div>
            </div>
          </div>
        )}

        {/* Trading vault pool */}
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
            <div>
              <div className="text-[10px] font-semibold text-blue-300">
                {isZh ? "交易金库池资金" : "Trading Vault Pool"}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {isZh ? "AI 量化交易池" : "AI Quant Trading Pool"}
              </div>
            </div>
          </div>
          <div className="text-right">
            {isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <>
                <div className="text-sm font-bold tabular-nums text-blue-300">
                  {fmtUsdt(data?.tradingPool.balance ?? 0)}
                </div>
                <div className="text-[9px] text-muted-foreground">USDT</div>
              </>
            )}
          </div>
        </div>

        {/* Bottom note */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <RefreshCw className="h-2.5 w-2.5" />
          <span>
            {isLive
              ? (isZh ? "数据来自链上 LP 合约" : "Data sourced from on-chain LP contract")
              : (isZh ? "上线后自动切换为链上LP实时数据" : "Will auto-switch to live on-chain LP data after launch")}
          </span>
        </div>
      </div>
    </div>
  );
}
