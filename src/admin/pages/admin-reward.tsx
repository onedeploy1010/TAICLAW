import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { MobileDataCard } from "@/admin/components/mobile-card";
import { StatsCard } from "@/admin/components/stats-card";
import {
  adminGetRewardsByUser, adminGetReviewStatusMap, adminAuditUserRewards,
  type UserRewardsRow, type ManualReviewStatus,
} from "@/admin/admin-api";
import { ManualReviewModal } from "@/admin/components/manual-review-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAdminAuth } from "@/admin/admin-auth";
import { CopyableAddress } from "@/admin/components/copy-address";
import { cellMA, cellUSD, formatUSD, formatNum, formatCompact, formatCompactUSD } from "@/admin/utils/format";
import {
  Coins, Wallet, Server, Users as UsersIcon, Gift, Search, Calendar,
  ArrowUpRight, Hourglass, CheckCircle2, Package, X, ArrowRightLeft,
  ChevronDown, ChevronUp, BarChart3, GitBranch, ExternalLink, TrendingUp,
} from "lucide-react";
import { SortableHeader, AdminPagination } from "@/admin/components/table-helpers";
import { YieldReconCard, useYieldReconciliation } from "@/admin/components/yield-recon-card";
import { Bug } from "lucide-react";

const RANKS = ["ALL", "V0", "V1", "V2", "V3", "V4", "V5", "V6"] as const;

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;

// Full-precision formatter for stats panel — no K/M abbreviation.
const fmtFull = (v: number) => formatNum(v, 2, 4);

// Table cells stay compact (rows would wrap otherwise).
const fmtMA = (v: number) => cellMA(v, 4) === "\u2014" ? "0" : cellMA(v, 4);

function RewardDetailDialog({ row, onClose }: { row: UserRewardsRow | null; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tab, setTab] = useState("yields");

  const wallet = row?.wallet ?? row?.userId ?? "";

  // Audit: expected vs actual (may fail for some wallets)
  const { data: audit } = useQuery({
    queryKey: ["admin", "audit-rewards", wallet],
    queryFn: async () => { try { return await adminAuditUserRewards(wallet); } catch { return null; } },
    enabled: !!wallet && !!row,
  });

  if (!row) return null;

  const goTo = (path: string) => { onClose(); navigate(path); };
  const bscAddr = `https://bscscan.com/address/${wallet}`;
  const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4" /> 收益详情
              {audit?.isAnomaly && <Badge className="bg-red-500/20 text-red-400 text-[9px] animate-pulse">异常</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs">
            {/* Header */}
            <div className="px-4 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <CopyableAddress value={wallet} />
                {row.rank && <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px]">{row.rank}</Badge>}
                {row.hasActivatedNode && <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">节点</Badge>}
                <a href={bscAddr} target="_blank" rel="noreferrer" className="ml-auto text-[9px] text-primary hover:underline">BscScan</a>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="w-full rounded-none border-y border-border/30 bg-muted/20 h-9">
                <TabsTrigger value="yields" className="text-[11px] flex-1">收益</TabsTrigger>
                <TabsTrigger value="audit" className="text-[11px] flex-1">审计</TabsTrigger>
                <TabsTrigger value="links" className="text-[11px] flex-1">关联</TabsTrigger>
              </TabsList>

              {/* ── Yields Tab ── */}
              <TabsContent value="yields" className="px-4 pb-4 mt-0 space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <MC label="金库收益" value={f(row.vaultMA)} unit="MA" color="text-green-400" />
                  <MC label="节点收益" value={f(row.nodeMA)} unit="MA" color="text-violet-400" />
                  <MC label="直推奖" value={f(row.directMA)} unit="MA" color="text-cyan-400" />
                  <MC label="团队奖" value={f(row.teamMA)} unit="MA" color="text-amber-400" />
                </div>
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 flex justify-between">
                  <span className="font-bold">总收益</span>
                  <span className="font-bold text-primary text-sm">{f(row.totalMA)} MA</span>
                </div>

                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pt-2">提现 / 释放</p>
                <div className="grid grid-cols-2 gap-2">
                  <MC label="已提现" value={f(row.claimedMA)} unit="MA" color="text-emerald-400" />
                  <MC label="待释放" value={f(row.pendingReleaseMA)} unit="MA" color="text-yellow-400" />
                  <MC label="释放余额" value={f(row.releaseBalanceMA)} unit="MA" color="text-pink-400" />
                  <MC label="已到钱包" value={f(row.releasedToWalletMA)} unit="MA" color="text-sky-400" />
                </div>

                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pt-2">闪兑</p>
                <div className="grid grid-cols-2 gap-2">
                  <MC label="闪兑 MA" value={f(row.swappedMA)} unit="MA" color="text-rose-400" />
                  <MC label={`闪兑 USDT (${row.swapCount}笔)`} value={`$${f(row.swappedUSDT)}`} color="text-emerald-400" />
                </div>
              </TabsContent>

              {/* ── Audit Tab ── */}
              <TabsContent value="audit" className="px-4 pb-4 mt-0 space-y-3 pt-2">
                {!audit ? (
                  <Skeleton className="h-40" />
                ) : (
                  <>
                    {/* Anomaly banner */}
                    {audit.isAnomaly && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px]">
                        <span className="font-bold">异常检测:</span> 实际收益偏差 {Number(audit.yieldDeviationPct).toFixed(1)}%
                        （超过 10% 阈值）
                      </div>
                    )}

                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">公式计算 vs 实际</p>
                    <div className="space-y-1">
                      <AuditRow label="金库收益" expected={audit.expectedVaultYield} actual={audit.actualVaultYield} />
                      <AuditRow label="节点收益" expected={audit.expectedNodeYield} actual={audit.actualNodeYield} />
                      <AuditRow label="经纪人收益" expected={0} actual={audit.actualBrokerTotal} note="公式无法预测" />
                      <div className="border-t border-border/30 my-1" />
                      <AuditRow label="总计" expected={audit.expectedTotal} actual={audit.actualTotal} bold />
                    </div>

                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pt-2">MA 流向</p>
                    <div className="grid grid-cols-2 gap-2">
                      <MC label="入金铸造 MA" value={f(Number(audit.maMintedDeposit))} color="text-green-400" />
                      <MC label="闪兑消耗 MA" value={f(Number(audit.maSwapped))} color="text-rose-400" />
                      <MC label="总提现" value={f(Number(audit.totalWithdrawn))} unit="MA" color="text-emerald-400" />
                      <MC label="总销毁" value={f(Number(audit.totalBurned))} unit="MA" color="text-red-400" />
                    </div>

                    <div className="text-[10px] text-muted-foreground pt-2">
                      入金: ${f(Number(audit.totalDeposit))} · 活跃仓位: {audit.activeVaultCount} · 天数: {audit.depositDays}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Links Tab ── */}
              <TabsContent value="links" className="px-4 pb-4 mt-0 space-y-2 pt-2">
                <LBtn icon={Package} label="查看订单" onClick={() => goTo(`/admin/orders?search=${wallet}`)} />
                <LBtn icon={ArrowRightLeft} label="提现/释放" onClick={() => goTo(`/admin/withdrawals?search=${wallet}`)} />
                <LBtn icon={UsersIcon} label="会员资料" onClick={() => goTo(`/admin/members?search=${wallet}`)} />
                <LBtn icon={GitBranch} label="推荐树" onClick={() => goTo(`/admin/referrals?search=${wallet}`)} />
                <a href={bscAddr} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> BscScan 地址页面
                  </Button>
                </a>
                <Button variant="outline" size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs border-primary/30 text-primary"
                  onClick={() => setReviewOpen(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 人工审核
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <ManualReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)}
        target={{ type: "REWARD", id: row.userId, userId: row.userId, walletAddress: wallet }} />
    </>
  );
}

function MC({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/30">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={`font-bold text-sm ${color || "text-foreground"}`}>{value}{unit ? ` ${unit}` : ""}</div>
    </div>
  );
}

function AuditRow({ label, expected, actual, note, bold }: { label: string; expected: number; actual: number; note?: string; bold?: boolean }) {
  const exp = Number(expected || 0);
  const act = Number(actual || 0);
  const diff = exp > 0 ? ((act - exp) / exp * 100) : (act > 0 ? 999 : 0);
  const isOk = Math.abs(diff) <= 10;
  const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <div className={`flex items-center justify-between text-[11px] ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-foreground/50" title="公式预期">{f(exp)}</span>
        <span className="text-[9px] text-muted-foreground">→</span>
        <span className={isOk ? "text-foreground" : "text-red-400 font-bold"} title="实际">{f(act)}</span>
        {note ? <span className="text-[8px] text-muted-foreground">({note})</span>
          : diff !== 0 && exp > 0 && <span className={`text-[9px] ${isOk ? "text-muted-foreground" : "text-red-400"}`}>({diff > 0 ? "+" : ""}{diff.toFixed(0)}%)</span>}
      </div>
    </div>
  );
}

function LBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs" onClick={onClick}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

export default function AdminRewards() {
  const { adminUser } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rankFilter, setRankFilter] = useState<string>("ALL");
  const [nodeFilter, setNodeFilter] = useState<"all" | "yes" | "no">("all");
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "UNREVIEWED" | "FINAL" | "PROBLEM">("ALL");
  const [problemStatusFilter, setProblemStatusFilter] = useState<"ALL" | "NORMAL" | "YIELD_ANOMALY" | "OVERSWAP" | "EXCESS_WITHDRAW">("ALL");
  const [handleStatusFilter, setHandleStatusFilter] = useState<"ALL" | "OK" | "AUTO_DEDUCTED" | "PENDING_FUTURE" | "UNRECOVERABLE">("ALL");
  const [selected, setSelected] = useState<UserRewardsRow | null>(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [reconFilter, setReconFilter] = useState<"ALL" | "PROBLEM" | "POSITIVE">("ALL");
  const [sortBy, setSortBy] = useState<string>("totalMA");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "rewards-by-user", page, search, dateFrom, dateTo, rankFilter, nodeFilter, problemStatusFilter, handleStatusFilter],
    queryFn: () => adminGetRewardsByUser({
      page, pageSize: PAGE_SIZE,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      rank: rankFilter === "ALL" ? undefined : rankFilter,
      hasActivatedNode: nodeFilter === "all" ? undefined : nodeFilter,
      problemStatus: problemStatusFilter,
      handleStatus: handleStatusFilter,
    }),
    enabled: !!adminUser,
  });

  const rowsRaw = data?.data ?? [];

  const { data: reviewMap } = useQuery({
    queryKey: ["admin", "rewards-reviews", rowsRaw.map((r) => r.userId).join(",")],
    queryFn: () => adminGetReviewStatusMap("REWARD", rowsRaw.map((r) => r.userId)),
    enabled: !!adminUser && rowsRaw.length > 0,
  });

  const rowsFiltered = reviewFilter === "ALL"
    ? rowsRaw
    : rowsRaw.filter((r) => {
        const st = reviewMap?.get(r.userId);
        if (reviewFilter === "UNREVIEWED") return !st;
        return st === reviewFilter;
      });

  // Client-side sorting
  const rows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rowsFiltered].sort((a: any, b: any) => {
      const av = Number(a[sortBy] ?? 0);
      const bv = Number(b[sortBy] ?? 0);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rowsFiltered, sortBy, sortDir]);
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 调试模式：对账数据
  const { data: reconRows = [], isLoading: reconLoading } = useYieldReconciliation(reconFilter);
  const reconFiltered = useMemo(() => {
    if (!debugMode) return [] as typeof reconRows;
    const s = search.toLowerCase().trim();
    return s ? reconRows.filter((r) => r.wallet_address.includes(s)) : reconRows;
  }, [reconRows, debugMode, search]);
  const reconTotalPages = Math.max(1, Math.ceil(reconFiltered.length / PAGE_SIZE));
  const reconPageRows = reconFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg lg:text-xl font-bold text-foreground">
          收益管理
          {total > 0 && <span className="text-sm font-normal text-muted-foreground ml-2">({total} 位会员)</span>}
        </h1>
        <div className="flex items-center gap-2">
          {debugMode && (
            <div className="flex items-center gap-1">
              {(["ALL", "PROBLEM", "POSITIVE"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setReconFilter(f); setPage(1); }}
                  className={`px-2 py-1 rounded-full text-[10px] ${
                    reconFilter === f
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  {f === "ALL" ? "全部" : f === "PROBLEM" ? "仅问题" : "有应得"}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setDebugMode(!debugMode); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
              debugMode
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
            }`}
            data-testid="button-debug-mode-toggle"
          >
            <Bug className="h-3 w-3" />
            {debugMode ? "调试模式开启" : "开启调试模式"}
          </button>
          <button onClick={() => {
            if (!rowsRaw?.length) return;
            const headers = ["钱包,等级,节点,金库存入,金库收益,节点收益,直推,团队,总收益,闪兑MA,闪兑USDT,提现,待释放,状态"];
            const csv = rowsRaw.map((r: any) => [r.wallet, r.rank, r.hasActivatedNode ? "YES" : "NO", r.vaultDepositUSD, r.vaultMA?.toFixed(2), r.nodeMA?.toFixed(2), r.directMA?.toFixed(2), r.teamMA?.toFixed(2), r.totalMA?.toFixed(2), r.swappedMA?.toFixed(2), r.swappedUSDT?.toFixed(2), r.claimedMA?.toFixed(2), r.pendingReleaseMA?.toFixed(2), (r as any).problemStatus || "NORMAL"].join(","));
            const blob = new Blob([headers.join("\n") + "\n" + csv.join("\n")], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `rewards_${new Date().toISOString().slice(0,10)}.csv`; a.click();
          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10 hover:bg-white/10">
            <ArrowUpRight className="h-3 w-3" /> 导出CSV
          </button>
        </div>
      </div>

      {/* Stats panel — collapsible + grouped */}
      <div className="rounded-xl" style={{ background: "var(--admin-glass)", border: "1px solid var(--admin-glass-border)" }}>
        <button onClick={() => setStatsOpen(!statsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> 收益统计
            {stats && <span className="text-foreground/50 normal-case font-normal ml-2">
              {stats.userCount ?? 0} 人 · 总 {fmtFull(stats.totalYieldMA ?? 0)} MA
            </span>}
          </span>
          {statsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {statsOpen && stats && (
          <div className="px-4 pb-4 space-y-4">
            {/* Hero: 总收益 大卡片 */}
            <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.03) 100%)", border: "1px solid rgba(37,99,235,0.25)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-blue-400/70 font-bold uppercase">总收益 (Total Yield)</div>
                  <div className="text-2xl font-mono font-bold text-blue-300 mt-1">{fmtFull(stats.totalYieldMA)} <span className="text-sm text-blue-400/50">MA</span></div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] text-muted-foreground">{stats.userCount} 用户 · 金库 {stats.activeVaultUserCount} · 节点 {stats.activeNodeUserCount}</div>
                  <div className="text-[10px] text-emerald-400">金库总存入 ${fmtFull(stats.totalVaultDepositUSD)}</div>
                </div>
              </div>
              {/* 收益三分 */}
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(37,99,235,0.15)" }}>
                <div>
                  <div className="text-[9px] text-emerald-400 font-bold">金库收益</div>
                  <div className="text-sm font-mono font-bold text-emerald-300">{fmtFull(stats.totalVaultMA)} MA</div>
                </div>
                <div>
                  <div className="text-[9px] text-violet-400 font-bold">节点收益</div>
                  <div className="text-sm font-mono font-bold text-violet-300">{fmtFull(stats.totalNodeMA)} MA</div>
                </div>
                <div>
                  <div className="text-[9px] text-amber-400 font-bold">经纪人</div>
                  <div className="text-sm font-mono font-bold text-amber-300">{fmtFull((stats.totalDirectMA ?? 0) + (stats.totalTeamMA ?? 0))} MA</div>
                </div>
              </div>
            </div>

            {/* 经纪人佣金展开 */}
            <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <div className="text-[9px] text-amber-400/70 font-bold uppercase mb-2">经纪人佣金明细</div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/15 p-2">
                  <div className="text-[9px] text-cyan-400">直推</div>
                  <div className="text-xs font-mono font-bold text-cyan-300">{fmtFull(stats.totalDirectMA)} MA</div>
                </div>
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-2">
                  <div className="text-[9px] text-amber-400">团队(合计)</div>
                  <div className="text-xs font-mono font-bold text-amber-300">{fmtFull(stats.totalTeamMA)} MA</div>
                </div>
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-2">
                  <div className="text-[9px] text-blue-400">级差</div>
                  <div className="text-xs font-mono font-bold text-blue-300">{fmtFull(stats.totalRankDiffMA ?? 0)} MA</div>
                </div>
                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 p-2">
                  <div className="text-[9px] text-indigo-400">同级</div>
                  <div className="text-xs font-mono font-bold text-indigo-300">{fmtFull(stats.totalSameRankMA ?? 0)} MA</div>
                </div>
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/15 p-2">
                  <div className="text-[9px] text-purple-400">越级</div>
                  <div className="text-xs font-mono font-bold text-purple-300">{fmtFull(stats.totalCrossRankMA ?? 0)} MA</div>
                </div>
              </div>
            </div>

            {/* 金库持仓 */}
            <div className="rounded-xl p-3" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.12)" }}>
              <div className="text-[9px] text-cyan-400/70 font-bold uppercase mb-2">金库</div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <StatsCard title="金库持仓" value={`$${fmtFull(stats.totalVaultDepositUSD)}`} subtitle={`${stats.activeVaultUserCount} 户 (ACTIVE)`} icon={Wallet} color="#10b981" />
                <StatsCard title="总入金" value={`$${fmtFull((stats as any).totalVaultAllDeposit ?? stats.totalVaultDepositUSD)}`} icon={Wallet} color="#06b6d4" />
                <StatsCard title="总赎回" value={`$${fmtFull((stats as any).totalVaultRedeemed ?? 0)}`} icon={ArrowUpRight} color="#ef4444" />
                <StatsCard title="非节点" value={`${Math.max(0, (stats.activeVaultUserCount ?? 0) - (stats.activeNodeUserCount ?? 0))} 户`} icon={Wallet} color="#64748b" />
                <StatsCard title="节点激活" value={`${stats.activeNodeUserCount} 户`} icon={Server} color="#8b5cf6" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/50" />
          <input
            type="text"
            placeholder="搜索钱包地址"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput.trim()), setPage(1))}
            className="h-8 w-full pl-8 pr-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80 placeholder:text-foreground/50 focus:outline-none focus:border-primary/30"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>搜索</Button>

        {/* Rank filter */}
        <select
          value={rankFilter}
          onChange={(e) => { setRankFilter(e.target.value); setPage(1); }}
          className="h-8 px-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80"
          title="等级筛选"
        >
          {RANKS.map((r) => (
            <option key={r} value={r} className="bg-background">{r === "ALL" ? "所有等级" : r}</option>
          ))}
        </select>

        {/* Review status filter */}
        <select
          value={reviewFilter}
          onChange={(e) => { setReviewFilter(e.target.value as any); setPage(1); }}
          className="h-8 px-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80"
          title="审核状态筛选"
        >
          <option value="ALL" className="bg-background">审核: 全部</option>
          <option value="UNREVIEWED" className="bg-background">未审核</option>
          <option value="FINAL" className="bg-background">✓ 已审核</option>
          <option value="PROBLEM" className="bg-background">⚠ 问题单</option>
        </select>

        {/* Activated node filter */}
        <select
          value={nodeFilter}
          onChange={(e) => { setNodeFilter(e.target.value as any); setPage(1); }}
          className="h-8 px-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80"
          title="是否拥有已激活节点"
        >
          <option value="all" className="bg-background">节点状态: 全部</option>
          <option value="yes" className="bg-background">已激活节点</option>
          <option value="no" className="bg-background">无激活节点</option>
        </select>

        {/* V7: 问题分类筛选 */}
        <select
          value={problemStatusFilter}
          onChange={(e) => { setProblemStatusFilter(e.target.value as any); setPage(1); }}
          className="h-8 px-2 text-xs rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300"
          title="问题分类"
        >
          <option value="ALL" className="bg-background">问题分类: 全部</option>
          <option value="NORMAL" className="bg-background">✓ 正常</option>
          <option value="YIELD_ANOMALY" className="bg-background">⚠ 收益异常</option>
          <option value="OVERSWAP" className="bg-background">⚠ 超额闪兑</option>
          <option value="EXCESS_WITHDRAW" className="bg-background">⚠ 超额提现</option>
        </select>

        {/* V7: 处理状态筛选 */}
        <select
          value={handleStatusFilter}
          onChange={(e) => { setHandleStatusFilter(e.target.value as any); setPage(1); }}
          className="h-8 px-2 text-xs rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300"
          title="处理状态"
        >
          <option value="ALL" className="bg-background">处理状态: 全部</option>
          <option value="OK" className="bg-background">✓ 正常无问题</option>
          <option value="AUTO_DEDUCTED" className="bg-background">✓ 已扣除处理</option>
          <option value="PENDING_FUTURE" className="bg-background">⏳ 待未来收益扣</option>
          <option value="UNRECOVERABLE" className="bg-background">✗ 无法处理</option>
        </select>

        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-foreground/50" />
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 px-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80" />
          <span className="text-foreground/50 text-xs">—</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 px-2 text-xs rounded-lg bg-muted/50 border border-border/30 text-foreground/80" />
        </div>
        {(search || dateFrom || dateTo || rankFilter !== "ALL" || nodeFilter !== "all" || reviewFilter !== "ALL" || problemStatusFilter !== "ALL" || handleStatusFilter !== "ALL") && (
          <button onClick={() => {
            setSearch(""); setSearchInput(""); setDateFrom(""); setDateTo("");
            setRankFilter("ALL"); setNodeFilter("all"); setReviewFilter("ALL");
            setProblemStatusFilter("ALL"); setHandleStatusFilter("ALL"); setPage(1);
          }} className="text-[11px] text-red-400/70 hover:text-red-400">清除</button>
        )}
      </div>

      {/* 调试模式：显示对账卡片列表替换原表格 */}
      {debugMode ? (
        reconLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : reconPageRows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">无对账数据</p>
        ) : (
          <>
            <div>
              {reconPageRows.map((r) => (
                <YieldReconCard key={r.wallet_address} row={r} />
              ))}
            </div>
            {reconTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
                <span className="text-xs text-muted-foreground">{page} / {reconTotalPages}</span>
                <Button size="sm" variant="outline" disabled={page === reconTotalPages} onClick={() => setPage(page + 1)}>下一页</Button>
              </div>
            )}
          </>
        )
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 lg:h-12 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Card-based list (unified mobile + desktop) */}
          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">暂无数据</p>
            ) : rows.map((r) => {
              const hasProblem = (r as any).problemStatus && (r as any).problemStatus !== "NORMAL";
              return (
                <div key={r.userId} onClick={() => setSelected(r)}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${hasProblem ? "border-amber-500/20" : "border-border/30"}`}
                  style={{ background: "var(--admin-glass)" }}>
                  {/* Row 1: Address + Status + Total */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-mono text-xs text-foreground/80">{r.wallet ?? r.userId}</span>
                      {r.rank && <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px]">{r.rank}</Badge>}
                      {r.hasActivatedNode && <Badge className="bg-emerald-500/15 text-emerald-400 text-[9px]">节点</Badge>}
                      {hasProblem && <Badge className="bg-amber-500/15 text-amber-400 text-[9px]">{(r as any).problemStatus}</Badge>}
                      {(r as any).handleStatus === "AUTO_DEDUCTED" && <Badge className="bg-emerald-500/15 text-emerald-400 text-[9px]">已扣除</Badge>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-bold text-primary">{fmtMA(r.totalMA)} MA</div>
                      <div className="text-[9px] text-muted-foreground">总收益</div>
                    </div>
                  </div>
                  {/* Row 2: Yield breakdown */}
                  <div className="grid grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-1 text-[10px]">
                    <div><span className="text-white/30">金库存入</span> <span className="font-mono text-foreground/70">{cellUSD(r.vaultDepositUSD)}</span></div>
                    <div><span className="text-emerald-400/50">金库</span> <span className="font-mono text-emerald-400/80">{fmtMA(r.vaultMA)}</span></div>
                    <div><span className="text-violet-400/50">节点</span> <span className="font-mono text-violet-400/80">{fmtMA(r.nodeMA)}</span></div>
                    <div><span className="text-cyan-400/50">直推</span> <span className="font-mono text-cyan-400/80">{fmtMA(r.directMA)}</span></div>
                    <div><span className="text-amber-400/50">团队</span> <span className="font-mono text-amber-400/80">{fmtMA(r.teamMA)}</span></div>
                    <div><span className="text-rose-400/50">闪兑</span> <span className="font-mono text-rose-400/80">{fmtMA(r.swappedMA)}</span></div>
                    <div><span className="text-yellow-400/50">提现</span> <span className="font-mono text-yellow-400/80">{fmtMA(r.claimedMA)}</span></div>
                    <div><span className="text-pink-400/50">待释放</span> <span className="font-mono text-pink-400/80">{fmtMA(r.pendingReleaseMA)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <RewardDetailDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
