import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Layers, Flame, BarChart2, Target } from "lucide-react";

interface PoolStats {
  mother: { usdtTotal: string; runeTotal: string; lockPositions: number; nodeCount: number; ratio: string };
  sub: { usdtTotal: string; runeTotal: string; burnPositions: number };
  reservePool: { balance: string; ratio: string };
  tradingPool: { balance: string };
  isLive: boolean;
}

const AMBER  = "#d4a832";
const RED    = "#ef4444";
const BLUE   = "#3b82f6";
const PURPLE = "#a855f7";

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(from + (target - from) * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function AnimCount({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const v = useCountUp(value);
  return <>{prefix}{v.toFixed(decimals)}{suffix}</>;
}

const MONTHLY_PROJECTION = [
  { month: "M1", deposits: 100,  trading: 45 },
  { month: "M2", deposits: 230,  trading: 104 },
  { month: "M3", deposits: 480,  trading: 216 },
  { month: "M4", deposits: 890,  trading: 401 },
  { month: "M5", deposits: 1600, trading: 720 },
  { month: "M6", deposits: 2800, trading: 1260 },
];

const CustomTooltipAlloc = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(10,8,4,0.95)", border: "1px solid rgba(255,255,255,0.10)" }}>
      <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
      <div className="text-muted-foreground mt-0.5">${d.value.toLocaleString()} USDT · {d.pct}%</div>
    </div>
  );
};

const CustomTooltipGrowth = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(10,8,4,0.95)", border: "1px solid rgba(255,255,255,0.10)" }}>
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex gap-2 justify-between">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-bold">${p.value.toLocaleString()}K</span>
        </div>
      ))}
    </div>
  );
};

export function VaultCharts() {
  const { data } = useQuery<PoolStats>({
    queryKey: ["/api/vault/pool-stats"],
    queryFn: () => fetch("/api/vault/pool-stats").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const motherUsdt  = Number(data?.mother?.usdtTotal  ?? 0);
  const reserveUsdt = Number(data?.reservePool?.balance ?? 0);
  const tradingUsdt = Number(data?.tradingPool?.balance  ?? 0);
  const totalUsdt   = motherUsdt + reserveUsdt + tradingUsdt;

  // Fixed protocol ratios: 35% / 45% / 20%
  const allocData = [
    { name: "母币底池", value: motherUsdt,  color: AMBER,  pct: "35" },
    { name: "交易金库", value: tradingUsdt, color: BLUE,   pct: "45" },
    { name: "储备金库", value: reserveUsdt, color: PURPLE, pct: "20" },
  ];

  const nodeCount  = data?.mother?.nodeCount    ?? 0;
  const lockCount  = data?.mother?.lockPositions ?? 0;
  const burnCount  = data?.sub?.burnPositions   ?? 0;
  const targetNodes = 100;
  const nodeProgress = Math.min((nodeCount / targetNodes) * 100, 100);

  const LABEL_STYLE = { fontSize: 9, fill: "rgba(255,255,255,0.38)", fontFamily: "monospace" };

  return (
    <div className="px-4 lg:px-6 space-y-4">

      {/* ── Section title ── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-4 w-4 rounded flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}>
          <BarChart2 className="h-2.5 w-2.5 text-blue-400" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">协议数据 / Protocol Analytics</span>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Layers,    color: AMBER,  label: "总锁仓",       val: totalUsdt,  prefix: "$", suffix: "",  dec: 0 },
          { icon: Target,    color: BLUE,   label: "交易池资金",    val: tradingUsdt, prefix: "$", suffix: "", dec: 0 },
          { icon: TrendingUp,color: PURPLE, label: "年化预期",      val: 8,          prefix: "",  suffix: "%", dec: 0 },
        ].map(({ icon: Icon, color, label, val, prefix, suffix, dec }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl px-2.5 py-2.5 text-center"
            style={{ background: `${color}0a`, border: `1px solid ${color}20` }}
          >
            <Icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color }} />
            <div className="text-[13px] font-bold tabular-nums" style={{ color }}>
              <AnimCount value={val} prefix={prefix} suffix={suffix} decimals={dec} />
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Allocation donut + legend ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="rounded-xl p-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">资金分配</div>
        <div className="flex items-center gap-4">
          <div style={{ width: 110, height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  animationBegin={0}
                  animationDuration={900}
                >
                  {allocData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipAlloc />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {allocData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${d.pct}%`, background: d.color }} />
                  </div>
                  <span className="font-bold tabular-nums w-10 text-right" style={{ color: d.color }}>{d.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Node recruitment progress ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14 }}
        className="rounded-xl p-3"
        style={{ background: "rgba(212,168,50,0.04)", border: "1px solid rgba(212,168,50,0.14)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">节点招募进度</div>
          <div className="text-[10px] font-bold tabular-nums" style={{ color: AMBER }}>
            {nodeCount} / {targetNodes} 节点
          </div>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${nodeProgress}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ background: `linear-gradient(90deg, ${AMBER}99, ${AMBER})`, boxShadow: `0 0 8px ${AMBER}60` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground">
          <span>上线条件：招募结束</span>
          <span style={{ color: AMBER }}>目标上线价 $0.028/RUNE</span>
        </div>
        <div className="mt-2 flex gap-3 text-[9px] text-muted-foreground">
          <span>底池比例 <span className="font-bold" style={{ color: BLUE }}>280万USDT : 1亿RUNE</span></span>
        </div>
      </motion.div>

      {/* ── TVL growth projection ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.20 }}
        className="rounded-xl p-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">TVL 增长预测（千USDT）</div>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_PROJECTION} barGap={2} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltipGrowth />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="deposits" name="总入金" fill={AMBER} opacity={0.75} radius={[3, 3, 0, 0]} animationDuration={1000} />
              <Bar dataKey="trading"  name="交易池" fill={BLUE}  opacity={0.75} radius={[3, 3, 0, 0]} animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-1 text-[9px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded" style={{ background: AMBER }} />总入金</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded" style={{ background: BLUE }} />交易池（45%）</span>
        </div>
      </motion.div>

      {/* ── Area chart: monthly yield accumulation ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.26 }}
        className="rounded-xl p-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">年化收益累计预测（8% / 月1%）</div>
        <div style={{ height: 110 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MONTHLY_PROJECTION.map((d, i) => ({
              ...d,
              yield: +(d.deposits * 0.08 * (i + 1) / 6).toFixed(1),
            }))}>
              <defs>
                <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltipGrowth />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="yield"
                name="年化收益"
                stroke={PURPLE}
                strokeWidth={2}
                fill="url(#yieldGrad)"
                dot={false}
                animationDuration={1400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

    </div>
  );
}
