import { useState, useEffect, type ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import {
  Sparkles, Zap, Coins, TrendingUp, Gift, DollarSign,
  Network, Terminal, Eye, Radar, Layers, Wallet, Copy,
  CheckCircle2, Share2, ArrowLeft, Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getNodeOverview, getNodeMemberships, validateAuthCode,
} from "@/lib/api";
import type { NodeOverview, NodeMembership } from "@shared/types";
import { NODE_PLANS } from "@/lib/data";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { NodePurchaseDialog } from "@/components/nodes/node-purchase-section";
import { RecruitModal } from "@/components/nodes/recruit-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ─────────────────────────────────────────────────────────────────────────
   Tier visual theme — per-tier colour palettes identical to rune.homes
──────────────────────────────────────────────────────────────────────────── */
type TierTheme = {
  nameCn: string; nameEn: string; priceUsdt: number;
  color: string; accentBright: string; accent: string; rgb: string;
  glow: string; ring: string; from: string; to: string;
  gradient: string; chip: string;
};

const TIER_THEME: Record<string, TierTheme> = {
  BASIC: {
    nameCn: "初级", nameEn: "BASIC NODE", priceUsdt: 1000,
    color: "text-slate-300", accentBright: "text-slate-100", accent: "text-slate-300",
    rgb: "148, 163, 184",
    glow: "shadow-[0_0_120px_rgba(148,163,184,0.65)]",
    ring: "border-slate-400/70", from: "from-slate-800/70", to: "to-slate-900/95",
    gradient: "from-slate-400/50 via-slate-600/18 to-transparent",
    chip: "bg-slate-500/25 border-slate-400/65 text-slate-100",
  },
  STANDARD: {
    nameCn: "中级", nameEn: "STANDARD NODE", priceUsdt: 2500,
    color: "text-blue-300", accentBright: "text-blue-100", accent: "text-blue-300",
    rgb: "96, 165, 250",
    glow: "shadow-[0_0_120px_rgba(96,165,250,0.72)]",
    ring: "border-blue-400/70", from: "from-blue-900/65", to: "to-slate-900/95",
    gradient: "from-blue-400/55 via-blue-600/18 to-transparent",
    chip: "bg-blue-500/25 border-blue-400/65 text-blue-100",
  },
  ADVANCED: {
    nameCn: "高级", nameEn: "ADVANCED NODE", priceUsdt: 5000,
    color: "text-emerald-300", accentBright: "text-emerald-100", accent: "text-emerald-300",
    rgb: "52, 211, 153",
    glow: "shadow-[0_0_120px_rgba(52,211,153,0.68)]",
    ring: "border-emerald-400/70", from: "from-emerald-900/65", to: "to-slate-900/95",
    gradient: "from-emerald-400/55 via-emerald-600/18 to-transparent",
    chip: "bg-emerald-500/25 border-emerald-400/65 text-emerald-100",
  },
  SUPER: {
    nameCn: "超级", nameEn: "SUPER NODE", priceUsdt: 10000,
    color: "text-amber-300", accentBright: "text-amber-100", accent: "text-amber-300",
    rgb: "251, 191, 36",
    glow: "shadow-[0_0_120px_rgba(251,191,36,0.75)]",
    ring: "border-amber-400/75", from: "from-amber-900/65", to: "to-slate-900/95",
    gradient: "from-amber-400/58 via-amber-600/18 to-transparent",
    chip: "bg-amber-500/25 border-amber-400/70 text-amber-100",
  },
  FOUNDER: {
    nameCn: "联创", nameEn: "FOUNDER NODE", priceUsdt: 50000,
    color: "text-purple-300", accentBright: "text-purple-100", accent: "text-purple-300",
    rgb: "192, 132, 252",
    glow: "shadow-[0_0_120px_rgba(192,132,252,0.78)]",
    ring: "border-purple-400/80", from: "from-purple-900/65", to: "to-slate-900/95",
    gradient: "from-purple-400/62 via-purple-600/20 to-transparent",
    chip: "bg-purple-500/25 border-purple-400/70 text-purple-100",
  },
  GENESIS: {
    nameCn: "创世", nameEn: "GENESIS NODE", priceUsdt: 0,
    color: "text-fuchsia-300", accentBright: "text-fuchsia-100", accent: "text-fuchsia-300",
    rgb: "217, 70, 239",
    glow: "shadow-[0_0_120px_rgba(217,70,239,0.78)]",
    ring: "border-fuchsia-400/80", from: "from-fuchsia-900/65", to: "to-slate-900/95",
    gradient: "from-fuchsia-400/62 via-fuchsia-600/20 to-transparent",
    chip: "bg-fuchsia-500/25 border-fuchsia-400/70 text-fuchsia-100",
  },
};

const DEFAULT_THEME: TierTheme = {
  nameCn: "—", nameEn: "NO NODE", priceUsdt: 0,
  color: "text-amber-300", accentBright: "text-amber-100", accent: "text-amber-300",
  rgb: "251, 191, 36",
  glow: "shadow-[0_0_80px_rgba(251,191,36,0.35)]",
  ring: "border-amber-500/60", from: "from-slate-700/70", to: "to-slate-900/95",
  gradient: "from-amber-400/40 via-amber-600/12 to-transparent",
  chip: "bg-amber-500/20 border-amber-400/60 text-amber-100",
};

/* ── Airdrop & weight specs per node tier ────────────────────────────────── */
const AIRDROP_PER_NODE: Record<string, { perSeat: number; total: string }> = {
  BASIC:    { perSeat: 1000,  total: "1.00M" },
  STANDARD: { perSeat: 3000,  total: "2.40M" },
  ADVANCED: { perSeat: 6250,  total: "2.50M" },
  SUPER:    { perSeat: 13000, total: "2.60M" },
  FOUNDER:  { perSeat: 75000, total: "1.50M" },
  GENESIS:  { perSeat: 0,     total: "—" },
};

const WEIGHT_PER_NODE: Record<string, { coeff: number; share: string }> = {
  BASIC:    { coeff: 1.0, share: "34.8%" },
  STANDARD: { coeff: 1.2, share: "33.4%" },
  ADVANCED: { coeff: 1.4, share: "19.5%" },
  SUPER:    { coeff: 1.6, share: "11.1%" },
  FOUNDER:  { coeff: 2.0, share: "1.4%"  },
  GENESIS:  { coeff: 2.0, share: "—"     },
};

/* ── Airdrop stages (4-batch, back-loaded per 2026 spec) ──────────────── */
const AIRDROP_BATCHES = [
  { pct: 10, priceAt: 0.028, title: "第一批", trig: "TLP ≥ 2.8M · 全网底池达标" },
  { pct: 20, priceAt: 0.070, title: "第二批", trig: "TLP ≥ 7M · 市值增长达标" },
  { pct: 30, priceAt: 0.175, title: "第三批", trig: "TLP ≥ 17.5M · 持续增长触发" },
  { pct: 40, priceAt: 0.350, title: "第四批", trig: "TLP ≥ 35M 或 180天时间锁到期" },
] as const;

/* ── Pool stages (4 TLP thresholds) ──────────────────────────────────── */
const POOL_STAGES = [
  { pct: 10, tlpM: 2.8,  driver: "fundraise" as const },
  { pct: 20, tlpM: 7,    driver: "market"    as const },
  { pct: 30, tlpM: 17.5, driver: "market"    as const },
  { pct: 40, tlpM: 35,   driver: "market"    as const },
];

/* ── Six dividend streams ────────────────────────────────────────────── */
const SIX_STREAMS = [
  { key: "qep",    short: "量化收益池",   tag: "策略分红 · QEP" },
  { key: "mother", short: "母币交易税",   tag: "1%母币税 → 分红" },
  { key: "sub",    short: "子币交易税",   tag: "1%子币税 → 分红" },
  { key: "c2c",    short: "C2C手续费",    tag: "平台撮合手续费" },
  { key: "new",    short: "新产品营收",   tag: "生态新项目收益" },
  { key: "pool",   short: "底池分红",     tag: "TLP流动池激励" },
] as const;

/* ── Platform feature matrix ─────────────────────────────────────────── */
const PLATFORM_FEATURES = [
  {
    label: "推广奖励系统", icon: Network, all: true, strategicBoost: false,
    iconCls: "text-cyan-300", iconBg: "bg-cyan-950/55", iconBorder: "border-cyan-500/40",
    glowFrom: "from-cyan-900/18", stripe: "from-cyan-400/75 via-cyan-500/35 to-transparent",
  },
  {
    label: "量化 API 接入", icon: Terminal, all: true, strategicBoost: true,
    iconCls: "text-blue-300", iconBg: "bg-blue-950/55", iconBorder: "border-blue-500/40",
    glowFrom: "from-blue-900/18", stripe: "from-blue-400/75 via-blue-500/35 to-transparent",
  },
  {
    label: "AI 信号助手",   icon: Eye,      all: true, strategicBoost: true,
    iconCls: "text-violet-300", iconBg: "bg-violet-950/55", iconBorder: "border-violet-500/40",
    glowFrom: "from-violet-900/18", stripe: "from-violet-400/75 via-violet-500/35 to-transparent",
  },
  {
    label: "行情预测雷达",  icon: Radar,    all: true, strategicBoost: true,
    iconCls: "text-amber-300", iconBg: "bg-amber-950/55", iconBorder: "border-amber-500/40",
    glowFrom: "from-amber-900/18", stripe: "from-amber-400/75 via-amber-500/35 to-transparent",
  },
  {
    label: "策略量化工具",  icon: Layers,   all: true, strategicBoost: true,
    iconCls: "text-emerald-300", iconBg: "bg-emerald-950/55", iconBorder: "border-emerald-500/40",
    glowFrom: "from-emerald-900/18", stripe: "from-emerald-400/75 via-emerald-500/35 to-transparent",
  },
] as const;

/* ── Genesis qualification thresholds ───────────────────────────────── */
const GENESIS_DIRECT_FOUNDER = 3;
const GENESIS_TEAM_FOUNDER   = 5;
const GENESIS_TEAM_SUPER     = 30;

/* ── Helper: compact USD format ─────────────────────────────────────── */
function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toFixed(0);
}

/* ── Spring-powered count-up ─────────────────────────────────────────── */
function CountUp({ to, fmt }: { to: number; fmt?: (n: number) => string }) {
  const mv     = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 46, damping: 13, restDelta: 0.5 });
  const [n, setN] = useState(0);
  useEffect(() => { mv.set(to); }, [mv, to]);
  useEffect(() => spring.on("change", (v) => setN(v)), [spring]);
  return <>{fmt ? fmt(n) : Math.round(n).toLocaleString("en-US")}</>;
}

/* ── BSC diamond logo ────────────────────────────────────────────────── */
function BscLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#F3BA2F" aria-hidden className={className}>
      <path d="M12 2l2.4 2.4-2.4 2.4-2.4-2.4L12 2z" />
      <path d="M6.8 7.2l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4z" />
      <path d="M17.2 7.2l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4z" />
      <path d="M12 12.4l2.4 2.4L12 17.2l-2.4-2.4L12 12.4z" />
    </svg>
  );
}

/* ── BenefitRow ──────────────────────────────────────────────────────── */
function BenefitRow({
  icon: Icon, label, value, sub, theme, highlight = false, delay = 0,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
  theme: TierTheme; highlight?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 55, damping: 14, delay }}
      whileHover={{ y: -3, scale: 1.02, transition: { type: "spring", stiffness: 320, damping: 18 } }}
      style={highlight ? { ["--tier-rgb" as string]: theme.rgb } : undefined}
      className={`relative rounded-xl border p-3 overflow-hidden transition-colors duration-300 ${
        highlight
          ? "surface-3d surface-3d-tinted border-white/20 bg-gradient-to-br from-white/[0.07] to-white/[0.02]"
          : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25"
      }`}
    >
      {highlight && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{ background: `radial-gradient(circle at 85% -20%, rgba(${theme.rgb}, 0.28), transparent 55%)` }}
        />
      )}
      <div className="relative flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mb-1.5">
        <Icon className={`h-3 w-3 ${highlight ? theme.accent : "text-muted-foreground/80"}`}
          style={highlight ? { filter: `drop-shadow(0 0 6px rgba(${theme.rgb}, 0.5))` } : undefined} />
        <span>{label}</span>
      </div>
      <div
        className={`relative text-xl font-bold tabular-nums ${highlight ? theme.accentBright : "text-foreground"}`}
        style={highlight ? { textShadow: `0 0 24px rgba(${theme.rgb}, 0.6)` } : undefined}
      >
        {value}
      </div>
      {sub && <div className="relative text-[11px] text-muted-foreground/80 mt-1 tracking-[0.12em] uppercase">{sub}</div>}
    </motion.div>
  );
}

/* ── BenefitGroup shell ──────────────────────────────────────────────── */
function BenefitGroup({
  icon: Icon, title, subtitle, rightTag, delay = 0, children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string; subtitle?: string; rightTag?: string; delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
    >
      <Card className="surface-3d relative overflow-hidden bg-gradient-to-br from-slate-600/85 to-slate-700/90 border-amber-500/55">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_55%)] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent pointer-events-none" />
        <CardHeader className="pb-3 border-b border-amber-500/20 relative z-10 flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.65)] shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            {subtitle && (
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/87 hidden sm:inline">{subtitle}</span>
            )}
          </div>
          {rightTag && (
            <span className="text-[11px] font-mono tabular-nums text-amber-200/85 shrink-0">{rightTag}</span>
          )}
        </CardHeader>
        <CardContent className="pt-5 pb-5 relative z-10">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

/* ── BenefitCell ─────────────────────────────────────────────────────── */
function BenefitCell({
  label, value, sub, theme, highlight = false,
}: {
  label: string; value: string; sub?: string; theme: TierTheme; highlight?: boolean;
}) {
  return (
    <div className={`rounded-md border p-2.5 ${
      highlight
        ? "border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-card/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]"
        : "border-border/50 bg-card/45"
    }`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground/80 mb-1.5">{label}</div>
      <div
        className={`text-xl sm:text-2xl font-bold tabular-nums leading-tight ${highlight ? theme.accentBright : "text-foreground"}`}
        style={highlight ? { textShadow: "0 0 18px rgba(251,191,36,0.5)" } : undefined}
      >{value}</div>
      {sub && <div className="text-xs text-muted-foreground/87 mt-1">{sub}</div>}
    </div>
  );
}

/* ── NodeBenefitsCard ────────────────────────────────────────────────── */
function NodeBenefitsCard({ nodeType }: { nodeType: string | null }) {
  if (!nodeType) {
    return (
      <Card className="bg-card/70 backdrop-blur border-border">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" /> 我的节点权益
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          尚未持有节点 · 购买节点后解锁全部权益
        </CardContent>
      </Card>
    );
  }

  const theme = TIER_THEME[nodeType] ?? DEFAULT_THEME;
  const plan = NODE_PLANS[nodeType as keyof typeof NODE_PLANS];
  const dailyUsdt = plan ? plan.price * plan.dailyRate : 0;
  const total180  = Math.round(dailyUsdt * 180);
  const airdrop   = AIRDROP_PER_NODE[nodeType];
  const rate      = plan?.directRewardRate ? `${(plan.directRewardRate * 100).toFixed(0)}%` : "—";
  const nodeId    = nodeType;

  return (
    <Card
      style={{ ["--tier-rgb" as string]: theme.rgb }}
      className={`surface-3d surface-3d-tinted relative overflow-hidden bg-gradient-to-br ${theme.from} ${theme.to} border ${theme.ring}`}
    >
      <div className={`absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br ${theme.gradient} blur-3xl pointer-events-none opacity-90`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none" />
      <CardHeader className="pb-3 border-b border-border/40 relative z-10">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${theme.accent}`} />
          <span>节点权益</span>
          <span className={`ml-auto text-[11px] font-mono uppercase tracking-[0.22em] rounded-md border px-2 py-0.5 ${theme.chip}`}>
            {theme.nameCn} · {theme.nameEn}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: DollarSign, label: "日产收益",   value: `$${dailyUsdt.toFixed(0)}`,           sub: "USDT / day",   highlight: false },
            { icon: TrendingUp, label: "180日累计",  value: `$${total180.toLocaleString()}`,       sub: "180 days",     highlight: true  },
            { icon: Gift,       label: "子币空投",   value: airdrop ? airdrop.perSeat.toLocaleString() : "—", sub: "SUB",   highlight: false },
            { icon: Coins,      label: "直推奖励",   value: rate,                                  sub: "直接邀请返佣", highlight: true  },
          ].map((row, idx) => (
            <BenefitRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
              sub={row.sub}
              theme={theme}
              highlight={row.highlight}
              delay={0.04 + idx * 0.05}
            />
          ))}
        </div>

        {/* 180-day cumulative sparkline */}
        {dailyUsdt > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28, ease: EASE }}
            className="mt-4 pt-4 border-t border-border/30"
          >
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/87">180日累计 USDT</span>
              <span className={`text-xs font-mono font-semibold ${theme.accent}`}>${total180.toLocaleString()}</span>
            </div>
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart
                data={Array.from({ length: 19 }, (_, i) => ({ day: i * 10, usdt: Math.round(dailyUsdt * i * 10) }))}
                margin={{ top: 2, right: 2, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`spark-${nodeId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`rgba(${theme.rgb},0.50)`} />
                    <stop offset="100%" stopColor={`rgba(${theme.rgb},0.02)`} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone" dataKey="usdt"
                  stroke={`rgba(${theme.rgb},0.9)`} strokeWidth={1.5}
                  fill={`url(#spark-${nodeId})`} dot={false} isAnimationActive
                />
                <XAxis dataKey="day" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "rgba(10,12,18,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", fontSize: "10px" }}
                  labelFormatter={(v) => `Day ${v}`}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Cumulative"]}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── PoolProgressCard ────────────────────────────────────────────────── */
function PoolProgressCard({
  nodeType, totalNodes,
}: {
  nodeType: string | null;
  totalNodes: number;
}) {
  const fundraiseCap  = 8_000_000;
  const tlpInitial    = 2_800_000;
  // Estimate from global node count × weighted avg price (~$3,200/node average)
  const totalRaised   = Math.min(fundraiseCap, totalNodes * 3200);
  const raisedPct     = fundraiseCap > 0 ? Math.min(100, (totalRaised / fundraiseCap) * 100) : 0;
  const fundraiseDone = raisedPct >= 100;
  const projectedTlp  = (totalRaised / fundraiseCap) * tlpInitial;

  const nextStageIdx = fundraiseDone ? 1 : 0;
  const nextStage    = POOL_STAGES[Math.min(3, nextStageIdx)];

  const userAirdrop   = nodeType ? AIRDROP_PER_NODE[nodeType] : null;
  const nextUnlock    = userAirdrop ? Math.round((userAirdrop.perSeat * nextStage.pct) / 100) : 0;

  const ALLOC = [
    { name: "TLP Pool",   pct: 40, color: "#34d399" },
    { name: "运营",       pct: 25, color: "#60a5fa" },
    { name: "国库",       pct: 25, color: "#a78bfa" },
    { name: "子币 LP",   pct: 10, color: "#fbbf24" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.03, ease: EASE }}
    >
      <Card className="surface-3d relative overflow-hidden border-emerald-500/55 bg-gradient-to-br from-slate-600/70 via-emerald-950/55 to-slate-700/88">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-emerald-500/35 via-cyan-500/20 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_55%)] pointer-events-none" />
        <CardHeader className="pb-3 border-b border-emerald-500/20 relative z-10 flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
            <span className="bg-gradient-to-r from-emerald-200 to-cyan-200 bg-clip-text text-transparent">
              全网底池达标进度
            </span>
          </CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300/80">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 relative z-10">
          {/* Fundraise bar */}
          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">全网募集进度</span>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground/82">{raisedPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-baseline gap-2 tabular-nums mb-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-200 drop-shadow-[0_0_14px_rgba(52,211,153,0.5)]">
                $<CountUp to={totalRaised} fmt={fmtUsd} />
              </span>
              <span className="text-xs text-muted-foreground/87">/ $8M USDT</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/40 overflow-hidden border border-emerald-500/15 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-teal-400 relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${raisedPct}%` }}
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              >
                <div className="animate-bar-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
              </motion.div>
            </div>
            <div className="text-[11px] text-muted-foreground/82 mt-2">
              {fundraiseDone ? "底池募集完成 · 第一阶段空投解锁触发" : "底池募集进行中 · 预计初始 TLP 注入 $2.8M"}
            </div>
          </div>

          {/* TLP projection */}
          <div className="rounded-md border border-cyan-500/35 bg-cyan-950/25 p-3 space-y-1.5 shadow-[inset_0_1px_0_rgba(34,211,238,0.15)]">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]">
              {fundraiseDone ? "初始 TLP 注入量" : "预计 TLP 启动量"}
            </div>
            <div className="text-xl font-bold tabular-nums text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]">
              ${fmtUsd(fundraiseDone ? tlpInitial : projectedTlp)} USDT
            </div>
            <p className="text-xs text-muted-foreground/90 leading-snug">
              底池填满后注入 40% = $2.8M TLP 作为交易流动性基础
            </p>
          </div>

          {/* Fund allocation donut */}
          <div className="rounded-md border border-border/25 bg-black/25 p-3 flex flex-col sm:flex-row items-center gap-4">
            <div className="shrink-0">
              <PieChart width={88} height={88}>
                <Pie data={ALLOC} cx={40} cy={40} innerRadius={24} outerRadius={40} dataKey="pct" strokeWidth={0} paddingAngle={2} isAnimationActive>
                  {ALLOC.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.85} />)}
                </Pie>
              </PieChart>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 w-full">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/87 mb-0.5">资金分配比例</div>
              {ALLOC.map((e) => (
                <div key={e.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                  <span className="text-muted-foreground/80 flex-1">{e.name}</span>
                  <span className="font-mono font-semibold tabular-nums" style={{ color: e.color }}>{e.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4 stage unlock milestones */}
          <div className="pt-1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/90 mb-3">空投解锁阶段</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {POOL_STAGES.map((stage, i) => {
                const unlocked = stage.driver === "fundraise" ? fundraiseDone : false;
                const isNext   = i === nextStageIdx && !unlocked;
                return (
                  <div
                    key={i}
                    className={`rounded-md border p-3 transition-colors relative overflow-hidden ${
                      unlocked
                        ? "border-emerald-500/60 bg-emerald-950/35 shadow-[inset_0_1px_0_rgba(52,211,153,0.2)]"
                        : isNext
                        ? "border-amber-500/60 bg-amber-950/30 ring-1 ring-amber-500/30 shadow-[0_0_16px_rgba(251,191,36,0.15)]"
                        : "border-border/50 bg-card/45"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/87">
                        第 {i + 1} 批
                      </span>
                      <span className={`text-[11px] font-mono uppercase tracking-[0.18em] ${
                        unlocked ? "text-emerald-300" : isNext ? "text-amber-300" : "text-muted-foreground/72"
                      }`}>
                        {unlocked ? "✓ 已解锁" : isNext ? "即将" : "锁定"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 tabular-nums">
                      <span className={`text-2xl font-bold ${unlocked ? "text-emerald-200 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]" : isNext ? "text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "text-foreground/80"}`}>
                        {stage.pct}%
                      </span>
                      <span className="text-[11px] text-muted-foreground/82">释放</span>
                    </div>
                    <div className={`text-[11px] tabular-nums mt-1 ${unlocked ? "text-emerald-400/80" : isNext ? "text-amber-400/80" : "text-muted-foreground/90"}`}>
                      TLP ≥ ${stage.tlpM}M
                    </div>
                    <div className="text-[11px] text-muted-foreground/72 mt-1">
                      {stage.driver === "fundraise" ? "底池募集完成触发" : "市值增长触发"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User's next-unlock projection */}
          {nodeType && userAirdrop && nextUnlock > 0 && (
            <div className="rounded-lg border border-amber-500/55 bg-gradient-to-br from-amber-950/45 via-amber-950/15 to-transparent p-4 space-y-3 shadow-[0_0_20px_rgba(251,191,36,0.1),inset_0_1px_0_rgba(251,191,36,0.2)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.22em] text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]">
                  你的下一批空投
                </span>
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300 shrink-0">
                  第{nextStageIdx + 1}批 · {nextStage.pct}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground/90 mb-1">你的解锁量</div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-amber-200">
                    {nextUnlock.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground/82 mt-0.5">母币 QA</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground/90 mb-1">该批参考价格</div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground/95">
                    ${AIRDROP_BATCHES[nextStageIdx]?.priceAt}
                  </div>
                  <div className="text-[11px] text-muted-foreground/82 mt-0.5">/ 每枚 QA</div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground/77 tabular-nums border-t border-amber-500/15 pt-2.5">
                {TIER_THEME[nodeType]?.nameCn} · {TIER_THEME[nodeType]?.nameEn} · {userAirdrop.perSeat.toLocaleString()} × {nextStage.pct}% = {nextUnlock.toLocaleString()} QA
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── GenesisEarningsPanel ────────────────────────────────────────────── */
function GenesisEarningsPanel({
  nodeType, directFounder, teamFounder, teamSuper,
}: {
  nodeType: string | null;
  directFounder: number;
  teamFounder: number;
  teamSuper: number;
}) {
  const directHit  = directFounder >= GENESIS_DIRECT_FOUNDER;
  const teamFndHit = teamFounder   >= GENESIS_TEAM_FOUNDER;
  const teamSupHit = teamSuper     >= GENESIS_TEAM_SUPER;
  const isGenesis  = directHit || teamFndHit || teamSupHit;

  if (!isGenesis) return null;

  const theme   = nodeType ? (TIER_THEME[nodeType] ?? DEFAULT_THEME) : DEFAULT_THEME;
  const weight  = nodeType ? WEIGHT_PER_NODE[nodeType] : null;
  const trigger = directHit ? "direct" : teamFndHit ? "teamFounder" : "teamSuper";

  const cells = [
    { label: "直推联创节点",     value: directFounder, target: GENESIS_DIRECT_FOUNDER, hit: trigger === "direct" },
    { label: "团队联创节点",     value: teamFounder,   target: GENESIS_TEAM_FOUNDER,   hit: trigger === "teamFounder" },
    { label: "团队超级节点",     value: teamSuper,     target: GENESIS_TEAM_SUPER,     hit: trigger === "teamSuper" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.04, ease: EASE }}
    >
      <Card className="surface-3d relative overflow-hidden border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-950/60 via-purple-950/40 to-amber-950/20">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-fuchsia-500/40 via-purple-500/20 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_60%)] pointer-events-none" />
        <CardHeader className="pb-3 border-b border-fuchsia-500/20 relative z-10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.55)]" />
            <span className="bg-gradient-to-r from-fuchsia-200 via-purple-200 to-amber-200 bg-clip-text text-transparent">
              创世节点资格 · Genesis Earnings
            </span>
            <span className="ml-auto text-[11px] font-mono uppercase tracking-[0.22em] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shrink-0">
              ✓ 已达标
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {cells.map((c) => {
              const pct = Math.min(100, Math.round((c.value / c.target) * 100));
              return (
                <div key={c.label} className={`rounded-lg border p-3 ${c.hit ? "border-fuchsia-500/65 bg-fuchsia-950/45" : "border-border/45 bg-card/40"}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 truncate">{c.label}</span>
                    {c.hit && <span className="text-[11px] font-mono uppercase text-fuchsia-300 shrink-0">✓ TRIGGER</span>}
                  </div>
                  <div className="flex items-baseline gap-1.5 tabular-nums">
                    <span className={`text-3xl font-bold ${c.hit ? "text-fuchsia-200" : "text-foreground/90"}`}>{c.value}</span>
                    <span className="text-sm text-muted-foreground/87">/ {c.target}</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className={`h-full ${c.hit ? "bg-gradient-to-r from-fuchsia-500 to-purple-400" : "bg-muted-foreground/40"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300/85 mb-0.5">创世奖励来源</div>
              <div className="text-base font-bold tabular-nums text-amber-200">核心激励池 10%</div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/90 mb-0.5">你的权重系数</div>
              <div className="text-sm font-semibold text-foreground/95 tabular-nums">
                {weight ? `${weight.coeff.toFixed(1)}×` : "—"}
                {nodeType && <span className="text-xs text-muted-foreground/87 ml-2">{TIER_THEME[nodeType]?.nameCn}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-fuchsia-500/25 bg-fuchsia-950/10 p-3 text-[11px] text-muted-foreground/85 leading-snug">
            <span className="text-fuchsia-300/90 font-semibold mr-1">·</span>
            创世分红结算周期链上执行，历史记录及待结算金额将在此显示。
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── BenefitsSection (4 groups) ──────────────────────────────────────── */
function BenefitsSection({ nodeType }: { nodeType: string | null }) {
  if (!nodeType) return null;

  const theme    = TIER_THEME[nodeType] ?? DEFAULT_THEME;
  const airdrop  = AIRDROP_PER_NODE[nodeType];
  const weight   = WEIGHT_PER_NODE[nodeType];
  const plan     = NODE_PLANS[nodeType as keyof typeof NODE_PLANS];
  const rate     = plan?.directRewardRate ? `${(plan.directRewardRate * 100).toFixed(0)}%` : "—";
  const isApex   = nodeType === "FOUNDER";

  return (
    <div className="space-y-4">

      {/* ── 1. 开盘价格 */}
      <BenefitGroup icon={Coins} title="开盘价格" subtitle="OPENING PRICES" delay={0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <BenefitCell label="母币 QA 开盘价" value="$0.028" sub="/ 每枚母币" theme={theme} highlight />
          <BenefitCell label="子币 SUB 开盘价"  value="$0.038" sub="/ 每枚子币" theme={theme} highlight />
        </div>
      </BenefitGroup>

      {/* ── 2. 空投解锁计划 */}
      <BenefitGroup
        icon={Gift}
        title="母币空投分批解锁"
        subtitle="STAGE-GATED AIRDROP"
        rightTag={airdrop ? `${airdrop.perSeat.toLocaleString()} / 每席位` : undefined}
        delay={0.04}
      >
        <div className="space-y-1.5">
          {AIRDROP_BATCHES.map((b, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-950/45 to-card/30 px-3 py-2.5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-amber-400/70 via-amber-500/50 to-amber-600/30 rounded-l pointer-events-none" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)] w-12 shrink-0">{b.title}</span>
              <span className="text-xl font-bold tabular-nums text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)] w-12 shrink-0">{b.pct}%</span>
              <p className="text-xs text-muted-foreground/90 leading-snug flex-1 min-w-0">{b.trig}</p>
            </div>
          ))}
        </div>
      </BenefitGroup>

      {/* ── 3. 分红池 · 六脉常态分红 */}
      <BenefitGroup
        icon={TrendingUp}
        title="六脉常态分红池"
        subtitle="DIVIDEND POOL"
        rightTag={`直推返佣: ${rate}`}
        delay={0.08}
      >
        <div className="space-y-4">
          {/* Weight + share panel */}
          <div className="rounded-lg border border-amber-500/60 bg-gradient-to-br from-amber-900/45 to-amber-950/20 p-4 shadow-[inset_0_1px_0_rgba(251,191,36,0.22)]">
            <div className="text-xs uppercase tracking-[0.22em] text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)] mb-3">
              你的分红池份额
            </div>
            <div className="grid grid-cols-2 gap-4 tabular-nums">
              <div>
                <div className="text-xs text-muted-foreground/90 mb-1">权重系数</div>
                <div className={`text-3xl sm:text-4xl font-bold ${theme.accentBright}`} style={{ textShadow: `0 0 20px rgba(${theme.rgb}, 0.5)` }}>
                  {weight ? `${weight.coeff.toFixed(1)}×` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground/90 mb-1">全网占比（满席）</div>
                <div className="text-3xl sm:text-4xl font-bold text-white">{weight?.share ?? "—"}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground/87 mb-0.5">节点等级</div>
              <div className={`text-base font-semibold ${theme.color}`}>{theme.nameEn} · {theme.nameCn}</div>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground/82 mt-3 border-t border-amber-500/10 pt-2.5">
              userReward = (yourWeight / totalWeight) × dividendPool
            </p>
          </div>

          {/* Six streams grid */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/90 mb-2.5">六脉收益来源</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SIX_STREAMS.map((s, i) => (
                <div
                  key={s.key}
                  className="flex items-center gap-2.5 rounded-md border border-amber-500/35 bg-gradient-to-r from-amber-950/35 to-card/35 px-3 py-2 hover:border-amber-500/55 hover:from-amber-950/50 transition-colors duration-300"
                >
                  <span className="shrink-0 h-6 w-6 rounded-full bg-amber-500/22 border border-amber-500/50 flex items-center justify-center text-[11px] font-mono text-amber-300 tabular-nums drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="text-xs font-semibold text-foreground">{s.short}</div>
                    <div className="text-[11px] text-muted-foreground/80">{s.tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BenefitGroup>

      {/* ── 4. 平台功能矩阵 */}
      <BenefitGroup icon={Sparkles} title="平台功能权益" subtitle="PLATFORM FEATURES" delay={0.12}>
        <div className="rounded-xl border border-amber-500/20 overflow-hidden divide-y divide-white/[0.06]">
          {PLATFORM_FEATURES.map((f, idx) => {
            const boosted = f.strategicBoost && isApex;
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className={`relative flex items-center gap-3 sm:gap-4 px-4 py-3.5 bg-gradient-to-r ${f.glowFrom} to-transparent transition-all duration-300 hover:brightness-[1.08]`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${f.stripe} pointer-events-none`} />
                <span className={`text-[11px] font-mono tabular-nums leading-none ${f.iconCls} opacity-40 w-4 shrink-0 pl-1`}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${f.iconBorder} ${f.iconBg} ${f.iconCls}`}>
                  <Icon className="h-4 w-4 drop-shadow-[0_0_8px_currentColor]" />
                </div>
                <p className="flex-1 text-sm font-semibold text-foreground/95 min-w-0 leading-tight">{f.label}</p>
                <div className="flex items-center gap-2.5 shrink-0">
                  {boosted && (
                    <span className="hidden sm:inline text-[11px] font-mono tracking-widest text-purple-300 bg-purple-950/70 border border-purple-500/35 rounded-full px-2 py-0.5 leading-none">
                      ×1.5 APEX
                    </span>
                  )}
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] shrink-0 text-emerald-400">
                    ● ACTIVE
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </BenefitGroup>

      <p className="text-[11px] text-muted-foreground/82 text-center pt-1">
        所有权益依据 QA 节点招募计划执行，链上智能合约保障兑现
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════════════════════ */
export default function ProfileNodesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;

  const [recruitOpen, setRecruitOpen]               = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseNodeType, setPurchaseNodeType]     = useState<string>("BASIC");
  const [authCodeDialogOpen, setAuthCodeDialogOpen] = useState(false);
  const [authCodeInput, setAuthCodeInput]           = useState("");
  const [authCodeError, setAuthCodeError]           = useState("");
  const [authCodeLoading, setAuthCodeLoading]       = useState(false);
  const [pendingNodeType, setPendingNodeType]        = useState<string>("SUPER");
  const [genesisInfoOpen, setGenesisInfoOpen]       = useState(false);
  const [referralCopied, setReferralCopied]         = useState(false);

  const handleNodeClick = (key: string) => {
    if (key === "GENESIS") { setGenesisInfoOpen(true); return; }
    if (key === "SUPER" || key === "FOUNDER") {
      setPendingNodeType(key);
      setAuthCodeInput(""); setAuthCodeError(""); setAuthCodeDialogOpen(true);
      return;
    }
    setPurchaseNodeType(key);
    setPurchaseDialogOpen(true);
  };

  const handleAuthCodeSubmit = async () => {
    if (authCodeInput.length !== 6) return;
    setAuthCodeLoading(true); setAuthCodeError("");
    try {
      const valid = await validateAuthCode(authCodeInput);
      if (valid) {
        setAuthCodeDialogOpen(false);
        setPurchaseNodeType(pendingNodeType);
        setPurchaseDialogOpen(true);
      } else {
        setAuthCodeError(t("profile.authCodeInvalid", "授权码无效，请重试"));
      }
    } catch {
      setAuthCodeError(t("profile.authCodeInvalid", "授权码无效，请重试"));
    } finally {
      setAuthCodeLoading(false);
    }
  };

  const { data: overview } = useQuery<NodeOverview>({
    queryKey: ["node-overview", walletAddr],
    queryFn: () => getNodeOverview(walletAddr),
    enabled: isConnected,
  });

  const { data: allMemberships = [] } = useQuery<NodeMembership[]>({
    queryKey: ["node-memberships", walletAddr],
    queryFn: () => getNodeMemberships(walletAddr),
    enabled: isConnected,
  });

  const { data: globalStats } = useQuery<{ totalMembers: number; activeMembers: number; totalNodes: number }>({
    queryKey: ["supabase-global-stats"],
    queryFn: async () => { const r = await fetch("/api/supabase/global-stats"); return r.json(); },
  });

  const { data: sbTeam } = useQuery<{
    directCount: number; teamSize: number; directUsdt: number; teamUsdt: number;
    ownNode: { nodeTier: string } | null;
    referrals: Array<{ nodeType?: string }>;
  }>({
    queryKey: ["supabase-team", walletAddr],
    queryFn: async () => { const r = await fetch(`/api/supabase/team/${walletAddr}`); return r.json(); },
    enabled: isConnected,
  });

  const nodes = overview?.nodes ?? [];
  const activeNodes = nodes.filter((n) => n.status === "ACTIVE" || n.status === "PENDING_MILESTONES");
  const firstNode   = activeNodes[0] ?? null;
  const nodeType    = firstNode?.nodeType ?? sbTeam?.ownNode?.nodeTier ?? null;
  const theme       = nodeType ? (TIER_THEME[nodeType] ?? DEFAULT_THEME) : DEFAULT_THEME;
  const totalNodes  = globalStats?.totalNodes ?? 0;

  /* Genesis qualification counts from team data */
  const directFounderCount = sbTeam?.referrals.filter(r => r.nodeType === "FOUNDER").length ?? 0;
  const teamFounderCount   = 0; // would need deeper traversal
  const teamSuperCount     = sbTeam?.referrals.filter(r => r.nodeType === "SUPER").length ?? 0;

  const referralLink = walletAddr ? `${window.location.origin}/r/${walletAddr}` : "—";

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      toast({ title: "已复制", description: "邀请链接已复制到剪贴板" });
      setTimeout(() => setReferralCopied(false), 1500);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-28 lg:pb-8" style={{ background: "#050505" }} data-testid="page-profile-nodes">

      {/* Page ambient warm glow */}
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.035] blur-[120px]" />
        <div className="absolute top-[55%] right-[8%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.025] blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[600px] h-[600px] -translate-x-1/2 rounded-full bg-slate-400/[0.018] blur-[140px]" />
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl space-y-4 sm:space-y-6">

        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          style={{ ["--tier-rgb" as string]: theme.rgb }}
          className={`surface-3d surface-3d-tinted relative overflow-hidden rounded-3xl border ${theme.ring} bg-gradient-to-br ${theme.from} ${theme.to} ${theme.glow}`}
        >
          {/* Pulse orb */}
          <motion.div
            aria-hidden
            className={`absolute -top-28 -right-28 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br ${theme.gradient} blur-3xl pointer-events-none`}
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.55, 0.95, 0.55] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-slate-400/5 via-transparent to-transparent blur-3xl pointer-events-none"
            animate={{ scale: [1.05, 0.92, 1.05], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_55%)] pointer-events-none" />
          {/* Horizontal sweep */}
          <div aria-hidden className="absolute inset-y-0 left-0 right-0 overflow-hidden pointer-events-none">
            <div className="animate-hero-sweep absolute top-0 bottom-0 w-[40%] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent mix-blend-overlay" />
          </div>
          {/* Ghost 符 watermark */}
          <div
            aria-hidden
            className="absolute bottom-[-10%] right-3 select-none pointer-events-none leading-none text-[clamp(8rem,40vw,17rem)] font-bold"
            style={{
              color: `rgba(${theme.rgb}, 0.055)`,
              fontFamily: "'Cinzel', 'Noto Serif SC', STSong, serif",
              filter: `blur(0.5px) drop-shadow(0 0 24px rgba(${theme.rgb},0.15))`,
            }}
          >
            符
          </div>
          {/* Floating particles */}
          {[0,1,2,3,4,5,6,7,8].map((i) => (
            <motion.span
              key={`p${i}`}
              aria-hidden
              className="absolute rounded-full pointer-events-none"
              style={{
                width:  i % 3 === 0 ? 3 : i % 3 === 1 ? 2.5 : 1.5,
                height: i % 3 === 0 ? 3 : i % 3 === 1 ? 2.5 : 1.5,
                left: `${9 + (i * 11.3) % 78}%`,
                top:  `${12 + (i * 14.7) % 72}%`,
                background: `rgba(${theme.rgb}, 0.7)`,
                boxShadow: `0 0 7px 2px rgba(${theme.rgb}, 0.45)`,
              }}
              animate={{
                y: [0, -(9 + (i % 4) * 4), 0],
                x: [0, i % 2 === 0 ? 4 : -4, 0],
                opacity: [0.22 + (i % 3) * 0.07, 0.78 + (i % 3) * 0.07, 0.22 + (i % 3) * 0.07],
                scale: [1, 1.3, 1],
              }}
              transition={{ duration: 4 + (i % 5) * 0.9, delay: i * 0.38, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}

          <div className="relative z-10 px-5 py-6 sm:px-6 sm:py-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
            <div className="space-y-2 min-w-0">
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08, ease: EASE }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80"
              >
                <Sparkles className="h-3 w-3 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]" />
                QA Protocol · 节点总览
              </motion.span>

              {nodeType ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.14, ease: EASE }}
                  className="space-y-1"
                >
                  <p className={`text-[11px] font-mono uppercase tracking-[0.32em] ${theme.color}`}>{theme.nameEn}</p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-none">
                    <span className={theme.accent} style={{ textShadow: `0 0 48px rgba(${theme.rgb}, 0.7)` }}>
                      {theme.nameCn}
                    </span>
                    <span className="text-foreground/55 text-base sm:text-xl ml-2 sm:ml-3 font-mono">节点</span>
                  </h1>
                </motion.div>
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">QA 节点控制台</h1>
              )}

              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.22, ease: EASE }}
                className="text-xs text-muted-foreground flex items-center gap-2 pt-1 min-w-0 flex-wrap"
              >
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-[11px] truncate max-w-[160px]">
                  {walletAddr ? `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}` : "未连接"}
                </span>
                <span className="opacity-50 shrink-0">·</span>
                <BscLogo className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">BNB Chain</span>
              </motion.div>
            </div>

            {nodeType && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
                className="flex items-center gap-4 shrink-0"
              >
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/85">已出资</p>
                  <p
                    className={`text-2xl sm:text-3xl font-bold tabular-nums ${theme.accentBright} leading-none mt-1`}
                    style={{ textShadow: `0 0 36px rgba(${theme.rgb}, 0.65)` }}
                  >
                    $<CountUp to={theme.priceUsdt} fmt={(n) => Math.round(n).toLocaleString("en-US")} />
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5 tracking-[0.18em] uppercase">USDT</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleNodeClick(nodeType)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold shrink-0"
                >
                  升级
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── 刻·下·即·永·恒 tagline ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
          className="flex items-center gap-3"
        >
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="shrink-0 text-[11px] tracking-[0.45em] font-medium select-none"
            style={{
              background: "linear-gradient(90deg, #92400e, #d97706, #fbbf24, #fef08a, #fbbf24, #d97706, #92400e)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            刻·下·即·永·恒
          </motion.span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        </motion.div>

        {/* ── Purchase node button ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.01, ease: EASE }}
        >
          <button
            type="button"
            disabled={!isConnected}
            onClick={() => setRecruitOpen(true)}
            data-testid="button-purchase-node"
            className="w-full relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/25 to-slate-800/80 px-5 py-4 text-left transition-all duration-300 group hover:border-amber-500/65 hover:shadow-[0_0_28px_rgba(251,191,36,0.18)] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.09),transparent_55%)] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/45 to-transparent pointer-events-none" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "radial-gradient(circle at 80% 50%, rgba(251,191,36,0.10), transparent 60%)" }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", boxShadow: "0 0 16px rgba(251,191,36,0.2)" }}>
                  <Sparkles className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-white">购买节点</div>
                  <div className="text-[11px] text-white/40 mt-0.5">6 档位 · 初级 → 创世 · 支付 USDT 即刻激活</div>
                </div>
              </div>
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center border border-amber-500/30 bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
            </div>
          </button>
        </motion.div>

        {/* ── Referral link card ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.02, ease: EASE }}
        >
          <Card className="surface-3d relative overflow-hidden bg-gradient-to-br from-slate-600/80 to-slate-700/88 border-amber-500/60">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/40 via-amber-600/20 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/55 to-transparent pointer-events-none" />
            <CardHeader className="pb-3 border-b border-amber-500/20 relative z-10">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
                我的邀请链接
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3 relative z-10">
              <p className="text-xs text-muted-foreground leading-relaxed">
                分享专属链接，下级购买节点后即时返佣到你的钱包，链上自动执行。
              </p>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-amber-500/15 bg-black/40 px-3 py-2 text-[11px] font-mono text-foreground/85 truncate shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {isConnected ? referralLink : "连接钱包后显示"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyReferral}
                  disabled={!isConnected}
                  className={`gap-1.5 shrink-0 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-400/60 hover:text-amber-200 transition-all ${referralCopied ? "animate-bounce" : ""}`}
                >
                  {referralCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {referralCopied ? "已复制" : "复制"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Main overview content ────────────────────────────────────── */}
        {isConnected ? (
          <div className="space-y-5">
            <NodeBenefitsCard nodeType={nodeType} />
            <PoolProgressCard nodeType={nodeType} totalNodes={totalNodes} />
            <GenesisEarningsPanel
              nodeType={nodeType}
              directFounder={directFounderCount}
              teamFounder={teamFounderCount}
              teamSuper={teamSuperCount}
            />
            <BenefitsSection nodeType={nodeType} />
          </div>
        ) : (
          <Card className="bg-card/70 backdrop-blur border-border">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-4 opacity-25" />
              请先连接钱包查看节点权益
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Recruit modal (tier picker from official design) ─────────── */}
      <RecruitModal
        open={recruitOpen}
        onClose={() => setRecruitOpen(false)}
        onSelectTier={(key) => handleNodeClick(key)}
      />

      {/* ── Purchase dialog ──────────────────────────────────────────────── */}
      <NodePurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        nodeType={purchaseNodeType}
        walletAddr={walletAddr}
      />

      {/* ── Auth code dialog (SUPER / FOUNDER) ──────────────────────────── */}
      <Dialog open={authCodeDialogOpen} onOpenChange={setAuthCodeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{t("profile.authCodeTitle", "输入授权码")}</DialogTitle>
          <DialogDescription>
            {t("profile.authCodeDesc", "购买超级节点 / 联创节点需要授权码，请联系上级获取")}
          </DialogDescription>
          <div className="space-y-3 pt-2">
            <input
              value={authCodeInput}
              onChange={(e) => setAuthCodeInput(e.target.value)}
              maxLength={6}
              placeholder="6位授权码"
              className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm font-mono tracking-widest focus:border-amber-500/60 focus:outline-none"
              data-testid="input-auth-code"
            />
            {authCodeError && <p className="text-xs text-destructive">{authCodeError}</p>}
            <Button
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
              onClick={handleAuthCodeSubmit}
              disabled={authCodeLoading || authCodeInput.length !== 6}
              data-testid="button-submit-auth-code"
            >
              {authCodeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("profile.authCodeConfirm", "确认")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Genesis info dialog ──────────────────────────────────────────── */}
      <Dialog open={genesisInfoOpen} onOpenChange={setGenesisInfoOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>创世节点 · GENESIS NODE</DialogTitle>
          <DialogDescription className="space-y-3 text-sm leading-relaxed pt-2">
            <p>创世节点通过以下任意一项条件达标后自动激活，无需购买：</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">①</span>
                <span>直推 ≥ {GENESIS_DIRECT_FOUNDER} 个联创节点（每个 50,000U）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">②</span>
                <span>团队内 ≥ {GENESIS_TEAM_FOUNDER} 个联创节点</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">③</span>
                <span>团队内 ≥ {GENESIS_TEAM_SUPER} 个超级节点（每个 10,000U）</span>
              </li>
            </ul>
            <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 text-xs">
              <span className="text-fuchsia-300 font-semibold">创世权益：</span>
              分享核心激励池 10%，按成员权重分配，链上自动结算。
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
