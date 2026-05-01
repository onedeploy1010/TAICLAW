import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Wallet, Server, TrendingUp, Coins, AlertTriangle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { StatsCard } from "@/admin/components/stats-card";
import {
  adminGetMemberDetail,
  adminRestorePosition,
  adminRestoreAllPositions,
  adminActivateNode,
  adminCreditYield,
  adminAddLog,
  type MemberDetail,
} from "@/admin/admin-api";
import { useAdminAuth } from "@/admin/admin-auth";
import { useToast } from "@/hooks/use-toast";
import { useThirdwebClient } from "@/hooks/use-thirdweb";
import { readContract, getContract } from "thirdweb";
import { BSC_CHAIN, V5_DIAMOND_ADDRESS } from "@/lib/contracts";
import { shortenAddress } from "@/lib/constants";
import { formatUSD } from "@/admin/utils/format";

const YIELD_ABI = "function getAvailableYieldV2(address user) view returns (uint256)";
const POOL_ABI = "function getReleasePool(address user) view returns (uint256)";
const ORDER_COUNT_ABI = "function getOrderCount(address user) view returns (uint256)";

const RANK_OPTIONS = ["V1", "V2", "V3", "V4", "V5"];

export default function AdminMemberManagePage() {
  const { adminUser, adminRole } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { client: twClient } = useThirdwebClient();

  const [searchInput, setSearchInput] = useState("");
  const [wallet, setWallet] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedRank, setSelectedRank] = useState<Record<string, string>>({});

  const handleSearch = () => {
    const w = searchInput.trim();
    if (w) setWallet(w);
  };

  // ── Member detail query ──
  const { data: member, isLoading, refetch } = useQuery<MemberDetail | null>({
    queryKey: ["admin", "member-detail", wallet],
    queryFn: () => adminGetMemberDetail(wallet),
    enabled: !!wallet,
  });

  // ── Chain state reads ──
  const { data: chainState } = useQuery({
    queryKey: ["admin", "chain-state", wallet],
    queryFn: async () => {
      if (!twClient || !wallet || !V5_DIAMOND_ADDRESS) return null;
      const contract = getContract({ client: twClient, chain: BSC_CHAIN, address: V5_DIAMOND_ADDRESS });
      const results = await Promise.allSettled([
        readContract({ contract, method: YIELD_ABI, params: [wallet] }),
        readContract({ contract, method: POOL_ABI, params: [wallet] }),
        readContract({ contract, method: ORDER_COUNT_ABI, params: [wallet] }),
      ]);
      return {
        yield: results[0].status === "fulfilled" ? Number(results[0].value) / 1e18 : 0,
        pool: results[1].status === "fulfilled" ? Number(results[1].value) / 1e18 : 0,
        orders: results[2].status === "fulfilled" ? Number(results[2].value) : 0,
      };
    },
    enabled: !!twClient && !!wallet && !!V5_DIAMOND_ADDRESS,
    staleTime: 15_000,
  });

  // ── Mutations ──
  const restorePositionMut = useMutation({
    mutationFn: async (positionId: string) => {
      await adminRestorePosition(positionId);
      await adminAddLog(adminUser || "", adminRole || "", "RESTORE_POSITION", "vault_positions", positionId, { wallet });
    },
    onSuccess: () => {
      toast({ title: "Position restored", description: "仓位已恢复为 ACTIVE" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreAllMut = useMutation({
    mutationFn: async () => {
      if (!member) return;
      const count = await adminRestoreAllPositions(member.profileId);
      await adminAddLog(adminUser || "", adminRole || "", "RESTORE_ALL_POSITIONS", "vault_positions", member.profileId, { wallet, count });
      return count;
    },
    onSuccess: (count) => {
      toast({ title: "All restored", description: `已恢复 ${count ?? 0} 个仓位` });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateNodeMut = useMutation({
    mutationFn: async ({ nodeId, rank }: { nodeId: string; rank: string }) => {
      await adminActivateNode(nodeId, rank);
      await adminAddLog(adminUser || "", adminRole || "", "ACTIVATE_NODE", "node_memberships", nodeId, { wallet, rank });
    },
    onSuccess: () => {
      toast({ title: "Node activated", description: "节点已激活" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const creditYieldMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(creditAmount);
      if (!amt || amt <= 0 || !wallet) throw new Error("Invalid amount");
      const res = await adminCreditYield(wallet, amt);
      if (!res.ok) throw new Error(res.error || "Failed");
      await adminAddLog(adminUser || "", adminRole || "", "CREDIT_YIELD", "profiles", member?.profileId, { wallet, amount: amt });
    },
    onSuccess: () => {
      toast({ title: "Yield credited", description: `已补发 ${creditAmount} MA 收益` });
      setCreditAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin", "chain-state", wallet] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const hasCancelledPositions = member?.positions.some((p) => p.status === "CANCELLED" || p.status === "PROBLEM");

  return (
    <div className="space-y-4 lg:space-y-6">
      <h1 className="text-lg lg:text-xl font-bold text-foreground">会员管理 (详情)</h1>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="输入钱包地址搜索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 bg-background/50 border-border/30 h-9 text-sm font-mono"
          />
        </div>
        <Button onClick={handleSearch} variant="outline" size="sm" className="shrink-0 h-9">
          搜索
        </Button>
      </div>

      {isLoading && wallet && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {wallet && !isLoading && !member && (
        <div className="text-center text-muted-foreground py-12 text-sm">未找到该钱包地址的会员信息</div>
      )}

      {member && (
        <>
          {/* ── Profile ── */}
          <section className="rounded-2xl border border-border/30 p-4 lg:p-5 space-y-3" style={{ background: "var(--admin-glass)" }}>
            <h2 className="text-sm font-bold text-foreground/70 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> 用户资料
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">钱包</span>
                <p className="font-mono text-primary text-xs mt-0.5">{shortenAddress(member.wallet)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">等级</span>
                <p className="mt-0.5">
                  <Badge variant="outline" className="text-xs">{member.rank || "无"}</Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">注册时间</span>
                <p className="text-foreground/70 text-xs mt-0.5">{new Date(member.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">状态</span>
                <p className="mt-0.5">
                  {member.isBlocked ? (
                    <Badge variant="destructive" className="text-xs">已封禁</Badge>
                  ) : (
                    <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/20">正常</Badge>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* ── Chain State ── */}
          <div className="grid grid-cols-3 gap-3">
            <StatsCard
              title="链上收益"
              value={chainState ? `${chainState.yield.toFixed(2)} MA` : "--"}
              icon={TrendingUp}
              color="#2563eb"
            />
            <StatsCard
              title="释放池"
              value={chainState ? `${chainState.pool.toFixed(2)} MA` : "--"}
              icon={Coins}
              color="#f59e0b"
            />
            <StatsCard
              title="链上订单"
              value={chainState ? String(chainState.orders) : "--"}
              icon={Server}
              color="#8b5cf6"
            />
          </div>

          {/* ── Vault Positions ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground/70">金库仓位 ({member.positions.length})</h2>
              {hasCancelledPositions && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={restoreAllMut.isPending}
                  onClick={() => restoreAllMut.mutate()}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${restoreAllMut.isPending ? "animate-spin" : ""}`} />
                  恢复全部
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-xs">本金</TableHead>
                    <TableHead className="text-xs">方案</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                    <TableHead className="text-xs">日利率</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">开始日期</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Bonus</TableHead>
                    <TableHead className="text-xs">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.positions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-foreground/50 text-sm py-6">暂无仓位</TableCell>
                    </TableRow>
                  ) : member.positions.map((p) => (
                    <TableRow key={p.id} className="border-border/30">
                      <TableCell className="text-sm font-medium">{formatUSD(p.principal)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.planType}</Badge></TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${
                          p.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          p.status === "CANCELLED" || p.status === "PROBLEM" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                          "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                        }`}>
                          {p.status}
                        </Badge>
                        {p.riskTag && <span className="text-[10px] text-red-400 ml-1">{p.riskTag}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-foreground/60">{(p.dailyRate * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-xs text-foreground/50 hidden lg:table-cell">{new Date(p.startDate).toLocaleDateString("zh-CN")}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {p.isBonus && <Badge className="text-[10px] bg-purple-500/15 text-purple-400">Bonus</Badge>}
                      </TableCell>
                      <TableCell>
                        {(p.status === "CANCELLED" || p.status === "PROBLEM") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-primary hover:text-primary"
                            disabled={restorePositionMut.isPending}
                            onClick={() => restorePositionMut.mutate(p.id)}
                          >
                            恢复
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ── Nodes ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground/70">节点 ({member.nodes.length})</h2>
            <div className="rounded-xl border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                    <TableHead className="text-xs">入金</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">冻结</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">激活等级</TableHead>
                    <TableHead className="text-xs">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.nodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-foreground/50 text-sm py-6">暂无节点</TableCell>
                    </TableRow>
                  ) : member.nodes.map((n) => (
                    <TableRow key={n.id} className="border-border/30">
                      <TableCell><Badge variant="outline" className="text-xs">{n.nodeType}</Badge></TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${
                          n.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          n.status === "PENDING" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
                          "bg-foreground/10 text-foreground/50"
                        }`}>
                          {n.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatUSD(n.depositAmount)}</TableCell>
                      <TableCell className="text-sm text-foreground/50 hidden lg:table-cell">{formatUSD(n.frozenAmount)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">{n.activatedRank || "--"}</Badge>
                      </TableCell>
                      <TableCell>
                        {n.status === "PENDING" && (
                          <div className="flex items-center gap-1.5">
                            <select
                              className="h-6 text-xs rounded border border-border/30 bg-background/50 px-1.5 text-foreground"
                              value={selectedRank[n.id] || "V1"}
                              onChange={(e) => setSelectedRank((prev) => ({ ...prev, [n.id]: e.target.value }))}
                            >
                              {RANK_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-primary hover:text-primary"
                              disabled={activateNodeMut.isPending}
                              onClick={() => activateNodeMut.mutate({ nodeId: n.id, rank: selectedRank[n.id] || "V1" })}
                            >
                              激活
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ── Transactions ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground/70">交易记录 (最近 {member.transactions.length} 条)</h2>
            <div className="rounded-xl border border-border/30 overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs">金额</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">TX Hash</TableHead>
                    <TableHead className="text-xs">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-foreground/50 text-sm py-6">暂无交易</TableCell>
                    </TableRow>
                  ) : member.transactions.map((tx, i) => (
                    <TableRow key={`${tx.createdAt}-${i}`} className="border-border/30">
                      <TableCell><Badge variant="outline" className="text-[10px]">{tx.type}</Badge></TableCell>
                      <TableCell className="text-sm">{formatUSD(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${
                          tx.status === "CONFIRMED" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          tx.status === "CANCELLED" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                          "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                        }`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono hidden lg:table-cell">
                        {tx.txHash ? shortenAddress(tx.txHash) : "--"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground/50">{new Date(tx.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ── Actions ── */}
          <section className="rounded-2xl border border-border/30 p-4 lg:p-5 space-y-4" style={{ background: "var(--admin-glass)" }}>
            <h2 className="text-sm font-bold text-foreground/70 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> 管理操作
            </h2>
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="number"
                  placeholder="补发收益金额 (MA)"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="bg-background/50 border-border/30 h-9 text-sm w-48"
                  min="0"
                  step="0.01"
                />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={creditYieldMut.isPending || !creditAmount}
                  onClick={() => creditYieldMut.mutate()}
                >
                  {creditYieldMut.isPending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Coins className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  补发收益
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
