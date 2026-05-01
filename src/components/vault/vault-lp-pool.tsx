import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Shield, BarChart2, TrendingUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface PoolStats {
  mother: { usdtTotal: string; runeTotal: string; lockPositions: number; nodeCount: number; ratio: string };
  sub: { usdtTotal: string; runeTotal: string; burnPositions: number };
  reservePool: { balance: string; ratio: string };
  tradingPool: { balance: string; contributionTotal: string; monthlyYield: string; annualYield: string; monthlyRate: string; poolRatio: string };
  nodes: {
    totalMembers: number;
    totalBuyers: number;
    purchaseCount: number;
    totalDepositUsdt: string;
    superNode: { count: number; totalUsdt: string; unitPrice: number };
    stdNode:   { count: number; totalUsdt: string; unitPrice: number };
  };
  isLive: boolean;
}

type PoolView = "mother" | "reserve";

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

const AMBER  = "rgba(212,168,50,0.9)";
const GREEN  = "rgba(34,197,94,0.9)";
const BLUE   = "rgba(59,130,246,0.9)";

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
  const accent = view === "mother" ? AMBER : GREEN;

  const POOL_TABS = [
    { key: "mother" as const, icon: TrendingUp, labelZh: "母币底池", labelEn: "Mother LP", accent: AMBER, pct: "35%" },
    { key: "reserve" as const, icon: Shield,    labelZh: "储备金库", labelEn: "Reserve",   accent: GREEN, pct: "20%" },
  ];

  return (
    <div
      className="relative mx-4 lg:mx-6 rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(14,14,22,0.95), rgba(10,10,16,0.98))",
        border: `1px solid ${accent}28`,
        boxShadow: `0 0 32px ${accent}10`,
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      {/* Top accent line */}
      <div className="absolute left-0 right-0 top-0 h-[1.5px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent} 70%, transparent 100%)`, opacity: 0.7 }} />

      {/* HUD corners */}
      {["top-1.5 left-1.5 border-t border-l rounded-tl", "top-1.5 right-1.5 border-t border-r rounded-tr",
        "bottom-1.5 left-1.5 border-b border-l rounded-bl", "bottom-1.5 right-1.5 border-b border-r rounded-br",
      ].map((cls, i) => (
        <span key={i} className={`absolute w-2.5 h-2.5 pointer-events-none ${cls}`} style={{ borderColor: accent, opacity: 0.5 }} />
      ))}

      {/* Scan line */}
      <div className="absolute inset-y-0 -left-full w-1/2 pointer-events-none animate-scan-pool"
        style={{ background: "linear-gradient(115deg, transparent 0%, transparent 40%, rgba(255,255,255,0.018) 50%, transparent 60%, transparent 100%)" }} />

      <style>{`
        @keyframes scanPool { from { transform: translateX(0%); } to { transform: translateX(400%); } }
        .animate-scan-pool { animation: scanPool 9s linear infinite; }
        @keyframes breathe { 0%,100% { opacity:0.45; transform:scale(1); } 50% { opacity:0; transform:scale(2.5); } }
        .dot-breathe { animation: breathe 2.2s ease-in-out infinite; }
      `}</style>

      <div className="relative z-10 px-4 py-3 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
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
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="dot-breathe absolute inline-flex h-full w-full rounded-full"
                style={{ background: isLive ? "rgb(34,197,94)" : accent }} />
              <span className="relative inline-flex h-full w-full rounded-full"
                style={{ background: isLive ? "rgb(34,197,94)" : accent }} />
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: isLive ? "rgb(34,197,94)" : accent }}>
              {isLive ? (isZh ? "实时LP" : "Live LP") : (isZh ? "节点沉淀" : "Pre-launch")}
            </span>
          </div>
        </div>

        {/* 3-pool ratio strip */}
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex h-2">
            <div className="h-full transition-all duration-700" style={{ width: "35%", background: AMBER, opacity: 0.75 }} />
            <div className="h-full transition-all duration-700" style={{ width: "45%", background: BLUE, opacity: 0.75 }} />
            <div className="h-full transition-all duration-700" style={{ width: "20%", background: GREEN, opacity: 0.75 }} />
          </div>
          <div className="flex text-[8.5px] font-semibold">
            <div className="flex-none w-[35%] text-center py-1" style={{ color: AMBER }}>母币 35%</div>
            <div className="flex-none w-[45%] text-center py-1" style={{ color: BLUE }}>交易 45%</div>
            <div className="flex-none w-[20%] text-center py-1" style={{ color: GREEN }}>储备 20%</div>
          </div>
        </div>

        {/* Toggle: Mother LP / Reserve Vault */}
        <div className="flex gap-1.5">
          {POOL_TABS.map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                view === tab.key ? "opacity-100" : "opacity-45 hover:opacity-65")}
              style={view === tab.key
                ? { background: `${tab.accent}18`, border: `1px solid ${tab.accent}35`, color: tab.accent }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
              data-testid={`button-vault-pool-${tab.key}`}>
              <tab.icon className="h-3 w-3" />
              {isZh ? tab.labelZh : tab.labelEn}
              <span className="ml-0.5 opacity-60">{tab.pct}</span>
            </button>
          ))}
        </div>

        {/* Pool stats */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : view === "mother" ? (
          <div className="space-y-2">
            {/* Total USDT bar */}
            <div className="rounded-xl px-3 py-2.5" style={{ background: `${AMBER}08`, border: `1px solid ${AMBER}18` }}>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    {isZh ? "节点总入金 (链上)" : "Node Deposits (On-chain)"}
                  </div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: AMBER }}>
                    {fmtUsdt(data?.nodes?.totalDepositUsdt ?? data?.mother?.usdtTotal ?? 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-muted-foreground">{isZh ? "注册会员" : "Members"}</div>
                  <div className="text-base font-bold" style={{ color: AMBER }}>
                    {data?.nodes?.totalMembers ?? data?.mother?.nodeCount ?? 0}
                  </div>
                </div>
              </div>
            </div>
            {/* Node tier breakdown */}
            <div className="grid grid-cols-2 gap-2">
              {/* Super node */}
              <div className="rounded-xl px-3 py-2" style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <div className="text-[8.5px] text-purple-400/70 uppercase tracking-wider mb-1">
                  {isZh ? "超级节点 · $2,500" : "Super Node · $2,500"}
                </div>
                <div className="text-base font-bold text-purple-300">
                  {data?.nodes?.superNode?.count ?? 0}
                  <span className="text-[9px] font-normal text-purple-400/60 ml-1">{isZh ? "个" : "nodes"}</span>
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {fmtUsdt(data?.nodes?.superNode?.totalUsdt ?? 0)}
                </div>
              </div>
              {/* Standard node */}
              <div className="rounded-xl px-3 py-2" style={{ background: `${AMBER}06`, border: `1px solid ${AMBER}20` }}>
                <div className="text-[8.5px] uppercase tracking-wider mb-1" style={{ color: `${AMBER}80` }}>
                  {isZh ? "标准节点 · $1,000" : "Std Node · $1,000"}
                </div>
                <div className="text-base font-bold" style={{ color: AMBER }}>
                  {data?.nodes?.stdNode?.count ?? 0}
                  <span className="text-[9px] font-normal ml-1" style={{ color: `${AMBER}60` }}>{isZh ? "个" : "nodes"}</span>
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {fmtUsdt(data?.nodes?.stdNode?.totalUsdt ?? 0)}
                </div>
              </div>
            </div>
            {/* Pre-launch RUNE info strip */}
            {!isLive && (
              <div className="flex items-center justify-between rounded-lg px-3 py-1.5"
                style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.14)" }}>
                <div className="text-[9px]" style={{ color: "rgba(212,168,50,0.7)" }}>
                  {isZh ? "上线价 $0.028 / QA · 280万USDT : 1亿QA" : "Launch $0.028/QA · 2.8M USDT : 100M QA"}
                </div>
                <div className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(212,168,50,0.12)", color: "rgba(212,168,50,0.9)" }}>
                  {isZh ? "未上线" : "Pre-launch"}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Reserve Pool view */
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2.5" style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}18` }}>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                {isZh ? "储备余额" : "Reserve Balance"}
              </div>
              <div className="text-xl font-bold tabular-nums" style={{ color: GREEN }}>
                {fmtUsdt(data?.reservePool?.balance ?? 0)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {isZh ? "总入金 20%" : "20% of deposits"}
              </div>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                {isZh ? "用途" : "Purpose"}
              </div>
              <div className="text-[11px] font-semibold mt-1 leading-snug" style={{ color: GREEN }}>
                {isZh ? "战略储备" : "Strategic Reserve"}
              </div>
              <div className="text-[9px] text-muted-foreground mt-1 leading-snug">
                {isZh ? "风控 · 回购 · 生态扩张" : "Risk · Buyback · Ecosystem"}
              </div>
            </div>
          </div>
        )}

        {/* Trading vault pool row */}
        <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)" }}>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
            <div>
              <div className="text-[10px] font-semibold text-blue-300">
                {isZh ? "交易金库池资金" : "Trading Vault Pool"}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {isZh ? "AI 量化交易池 · 45%" : "AI Quant Trading Pool · 45%"}
              </div>
            </div>
          </div>
          <div className="text-right">
            {isLoading ? <Skeleton className="h-5 w-16" /> : (
              <>
                <div className="text-sm font-bold tabular-nums text-blue-300">
                  {fmtUsdt(data?.tradingPool?.balance ?? 0)}
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
