import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart2, TrendingUp, Zap, Shield, RefreshCw, Activity } from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { VaultCalendar } from "./vault-calendar";

interface PoolStats {
  tradingPool: {
    balance: string;
    contributionTotal: string;
    monthlyYield: string;
    poolRatio: string;
  };
  isLive: boolean;
}

/* ── Animated number that jitters in a range ── */
function FlickerRate({ min, max, decimals = 1, suffix = "%" }: {
  min: number; max: number; decimals?: number; suffix?: string;
}) {
  const [val, setVal] = useState((min + max) / 2);
  const ref = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    ref.current = setInterval(() => {
      const next = min + Math.random() * (max - min);
      setVal(next);
    }, 1800 + Math.random() * 1200);
    return () => clearInterval(ref.current);
  }, [min, max]);
  return <>{val.toFixed(decimals)}{suffix}</>;
}

/* ── Animated count-up ── */
function CountUp({ target, prefix = "", suffix = "", decimals = 0, duration = 1000 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(target * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{prefix}{val.toFixed(decimals)}{suffix}</>;
}

/* ── Simulated monthly performance data (20–40%) ── */
function buildPerf() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((m, i) => ({
    month: m,
    rate: +(20 + Math.abs(Math.sin(i * 0.9 + 1.2)) * 20).toFixed(1),
  }));
}
const PERF_DATA = buildPerf();

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]"
      style={{ background: "rgba(10,8,4,0.95)", border: "1px solid rgba(59,130,246,0.25)" }}>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-bold text-blue-300">{payload[0].value}%</div>
    </div>
  );
};

export function TradingVaultBanner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";

  const { data, isLoading } = useQuery<PoolStats>({
    queryKey: ["/api/vault/pool-stats"],
    queryFn: () => fetch("/api/vault/pool-stats").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const balance    = Number(data?.tradingPool?.balance    ?? 0);
  const totalDeposits = Number(data?.tradingPool?.contributionTotal ?? 0);

  const fmtUsd = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  const STATS = [
    {
      icon: TrendingUp,
      color: "#3b82f6",
      label: isZh ? "月化收益率" : "Monthly Return",
      value: <FlickerRate min={20} max={40} decimals={1} suffix="%" />,
      sub: isZh ? "动态浮动" : "Floating",
    },
    {
      icon: Zap,
      color: "#d4a832",
      label: isZh ? "总管理资金" : "Total AUM",
      value: isLoading ? "—" : <CountUp target={balance} prefix="$" decimals={2} />,
      sub: isZh ? "入金 45%" : "45% of deposits",
    },
    {
      icon: Activity,
      color: "#a855f7",
      label: isZh ? "年化预期" : "Annual Est.",
      value: <><FlickerRate min={240} max={480} decimals={0} suffix="%" /></>,
      sub: isZh ? "复利计算" : "Compounded",
    },
    {
      icon: Shield,
      color: "#22c55e",
      label: isZh ? "策略状态" : "Status",
      value: isZh ? "运行中" : "Running",
      sub: isZh ? "AI量化交易" : "AI Quant",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mx-4 lg:mx-0 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(10,12,28,0.98) 0%, rgba(6,8,18,0.99) 100%)",
        border: "1px solid rgba(59,130,246,0.28)",
        boxShadow: "0 0 40px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Top accent line */}
      <div className="h-[2px] w-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.7) 20%, rgba(212,168,50,0.6) 60%, rgba(59,130,246,0.7) 80%, transparent)" }} />

      {/* HUD corners */}
      {["top-2 left-2 border-t border-l", "top-2 right-2 border-t border-r",
        "bottom-2 left-2 border-b border-l", "bottom-2 right-2 border-b border-r",
      ].map((cls, i) => (
        <span key={i} className={`absolute w-3 h-3 rounded-sm pointer-events-none ${cls}`}
          style={{ borderColor: "rgba(59,130,246,0.35)" }} />
      ))}

      <div className="relative p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <BarChart2 className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-blue-300 leading-tight">
                {isZh ? "总管理金库" : "Total Management Vault"}
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight">
                {isZh ? "AI 量化交易池 · 入金 45%" : "AI Quant Trading Pool · 45% of Deposits"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-full w-full rounded-full bg-blue-400" />
            </span>
            <span className="text-[9px] uppercase tracking-widest font-semibold text-blue-400">
              {isZh ? "实时运行" : "Live"}
            </span>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, color, label, value, sub }) => (
            <div key={label} className="rounded-xl px-3 py-2.5"
              style={{ background: `${color}0c`, border: `1px solid ${color}22` }}>
              <Icon className="h-3.5 w-3.5 mb-1.5" style={{ color }} />
              <div className="text-[15px] font-black tabular-nums leading-none" style={{ color }}>
                {value}
              </div>
              <div className="text-[9px] text-muted-foreground mt-1 leading-tight">{label}</div>
              <div className="text-[8px] mt-0.5" style={{ color: `${color}99` }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Monthly performance area chart */}
        <div className="rounded-xl px-3 pt-3 pb-2"
          style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {isZh ? "月化收益走势 (20%–40%)" : "Monthly Return Trend (20%–40%)"}
            </span>
            <span className="text-[9px] font-semibold text-blue-400">
              {isZh ? "模拟预测" : "Projected"}
            </span>
          </div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PERF_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month"
                  tick={{ fontSize: 8.5, fill: "rgba(255,255,255,0.32)", fontFamily: "monospace" }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, 50]}
                  tick={{ fontSize: 8, fill: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(59,130,246,0.2)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#tvGrad)"
                  dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Range labels */}
          <div className="flex justify-between text-[8.5px] text-muted-foreground mt-1 px-1">
            <span className="text-yellow-400/70">▼ 20% {isZh ? "区间下限" : "Floor"}</span>
            <span className="text-blue-400/70">▲ 40% {isZh ? "区间上限" : "Ceiling"}</span>
          </div>
        </div>

        {/* AI Quant Calendar */}
        <VaultCalendar />

        {/* Footer note */}
        <div className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground">
          <RefreshCw className="h-2.5 w-2.5 shrink-0" />
          <span>
            {isZh
              ? `总入金 ${fmtUsd(totalDeposits)} × 45% = 交易金库 ${fmtUsd(balance)} · 节点招募结束后正式启动`
              : `Total deposits ${fmtUsd(totalDeposits)} × 45% = Trading vault ${fmtUsd(balance)} · Activates after node recruitment ends`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
