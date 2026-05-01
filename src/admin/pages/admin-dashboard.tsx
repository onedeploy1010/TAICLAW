import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, Server, TrendingUp, UserPlus, GitBranch, Activity, LayoutDashboard, ArrowUpRight, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { adminGetPerformanceStats } from "@/admin/admin-api";
import { useAdminAuth } from "@/admin/admin-auth";
import { shortenAddress, formatUSD } from "@/lib/constants";

function StatCard({
  title, value, sub, icon: Icon, color, highlight,
}: {
  title: string; value: string | number; sub?: string;
  icon: any; color: string; highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 lg:p-5 border flex flex-col gap-2 ${highlight ? "border-primary/30" : "border-border/20"}`}
      style={{ background: highlight ? "linear-gradient(135deg,rgba(10,186,181,0.06),rgba(10,186,181,0.02))" : "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider">{title}</span>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}14`, border: `1px solid ${color}25` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-xl lg:text-2xl font-black text-foreground/90 leading-none">{value}</p>
        {sub && <p className="text-[10px] text-foreground/30 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-primary/60" />
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{children}</h2>
    </div>
  );
}

function ActivityRow({ label, value, sub, badge, badgeColor }: {
  label: string; value: string; sub?: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/[0.08] last:border-0">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-mono text-foreground/70 truncate">{label}</span>
        {sub && <span className="text-[10px] text-foreground/30 mt-0.5">{sub}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor || "bg-primary/10 text-primary"}`}>{badge}</span>
        )}
        <span className="text-xs font-semibold text-foreground/60">{value}</span>
      </div>
    </div>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-foreground/50 capitalize">{label}</span>
        <span className="text-foreground/40">{count} <span className="text-foreground/20">({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const NODE_COLORS: Record<string, string> = {
  basic: "#6366f1", standard: "#0abab5", advanced: "#f59e0b", premium: "#22c55e", enterprise: "#8b5cf6",
};
const VAULT_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e", COMPLETED: "#3b82f6", WITHDRAWN: "#6b7280",
};

export default function AdminDashboard() {
  const { adminUser } = useAdminAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "performance-stats"],
    queryFn: () => adminGetPerformanceStats(),
    enabled: !!adminUser,
    refetchInterval: 30000,
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });

  const totalNodes = Number(stats?.totalNodes ?? 0);
  const totalVaults = Number(stats?.totalVaultPositions ?? 0);

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary/60" />
          <h1 className="text-base lg:text-lg font-bold text-foreground/80">运营总览</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-foreground/25">
          <Clock className="h-3 w-3" />
          <span>{dateStr} {timeStr}</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
        </div>
      </div>

      {/* Row 1: Primary KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 lg:h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="总注册用户" value={stats?.totalUsers ?? 0} sub="累计账户数" icon={Users} color="#6366f1" />
          <StatCard title="金库 TVL" value={formatUSD(Number(stats?.tvl ?? 0))} sub="活跃仓位总额" icon={Wallet} color="#0abab5" highlight />
          <StatCard title="活跃节点" value={`${stats?.activeNodes ?? 0} / ${totalNodes}`} sub="活跃 / 总计" icon={Server} color="#f59e0b" />
          <StatCard title="累计佣金" value={formatUSD(Number(stats?.totalCommissions ?? 0))} sub="团队推荐奖励" icon={TrendingUp} color="#22c55e" />
        </div>
      )}

      {/* Row 2: Secondary KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="今日新增" value={stats?.newUsersToday ?? 0} sub="今日注册用户" icon={UserPlus} color="#8b5cf6" />
          <StatCard title="金库持仓" value={totalVaults} sub="全部金库仓位" icon={Wallet} color="#3b82f6" />
          <StatCard title="推荐关系" value={stats?.totalReferrals ?? 0} sub="有推荐人的用户" icon={GitBranch} color="#ec4899" />
          <StatCard title="AI模拟交易" value={stats?.totalPaperTrades ?? 0} sub="paper trades 总计" icon={Activity} color="#0abab5" />
        </div>
      )}

      {/* Bottom: Distribution + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* Node Distribution */}
        <div className="rounded-2xl border border-border/20 p-4 lg:p-5" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}>
          <SectionTitle>节点分布</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-6 rounded" />)}</div>
          ) : !stats?.nodeTypeDistribution?.length ? (
            <p className="text-xs text-foreground/20 text-center py-6">暂无节点数据</p>
          ) : (
            <div className="space-y-3">
              {stats.nodeTypeDistribution.map((n: any) => (
                <DistBar
                  key={n.node_type}
                  label={n.node_type}
                  count={parseInt(n.cnt)}
                  total={totalNodes}
                  color={NODE_COLORS[n.node_type] || "#6366f1"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Vault Status Distribution */}
        <div className="rounded-2xl border border-border/20 p-4 lg:p-5" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}>
          <SectionTitle>金库状态</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-6 rounded" />)}</div>
          ) : !stats?.vaultStatusDistribution?.length ? (
            <p className="text-xs text-foreground/20 text-center py-6">暂无金库数据</p>
          ) : (
            <div className="space-y-3">
              {stats.vaultStatusDistribution.map((v: any) => (
                <DistBar
                  key={v.status}
                  label={{ ACTIVE: "活跃", COMPLETED: "已完成", WITHDRAWN: "已提取" }[v.status as string] || v.status}
                  count={parseInt(v.cnt)}
                  total={totalVaults}
                  color={VAULT_COLORS[v.status] || "#6366f1"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Members */}
        <div className="rounded-2xl border border-border/20 p-4 lg:p-5" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}>
          <SectionTitle>最新注册用户</SectionTitle>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-9 rounded" />)}</div>
          ) : !stats?.recentMembers?.length ? (
            <p className="text-xs text-foreground/20 text-center py-6">暂无用户数据</p>
          ) : (
            <div>
              {stats.recentMembers.map((m: any, i: number) => (
                <ActivityRow
                  key={i}
                  label={shortenAddress(m.walletAddress || "-")}
                  value={m.createdAt ? new Date(m.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "-"}
                  badge={m.rank}
                  badgeColor="bg-primary/10 text-primary border border-primary/20 text-[9px]"
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Vault Positions */}
        <div className="rounded-2xl border border-border/20 p-4 lg:p-5 lg:col-span-2" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}>
          <SectionTitle>最新金库仓位</SectionTitle>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-9 rounded" />)}</div>
          ) : !stats?.recentVaults?.length ? (
            <p className="text-xs text-foreground/20 text-center py-6">暂无金库数据</p>
          ) : (
            <div>
              {stats.recentVaults.map((v: any, i: number) => (
                <ActivityRow
                  key={i}
                  label={shortenAddress(v.walletAddress || "-")}
                  sub={v.planType || "-"}
                  value={formatUSD(Number(v.principal ?? 0))}
                  badge={v.status}
                  badgeColor={
                    v.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 text-[9px]" :
                    v.status === "COMPLETED" ? "bg-blue-500/10 text-blue-400 text-[9px]" :
                    "bg-gray-500/10 text-gray-400 text-[9px]"
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Rewards */}
        <div className="rounded-2xl border border-border/20 p-4 lg:p-5" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))" }}>
          <SectionTitle>最新奖励发放</SectionTitle>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-9 rounded" />)}</div>
          ) : !stats?.recentRewards?.length ? (
            <p className="text-xs text-foreground/20 text-center py-6">暂无奖励数据</p>
          ) : (
            <div>
              {stats.recentRewards.map((r: any, i: number) => (
                <ActivityRow
                  key={i}
                  label={shortenAddress(r.walletAddress || "-")}
                  sub={r.rewardType?.replace(/_/g, " ")}
                  value={`+${formatUSD(Number(r.amount ?? 0))}`}
                  badge="奖励"
                  badgeColor="bg-emerald-500/10 text-emerald-400 text-[9px]"
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
