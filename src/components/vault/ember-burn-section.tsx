import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Flame, Sparkles, Trophy, Coins, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const BURN_TIERS = [
  { min: 0,    max: 99,   rate: 0.010, label: "1.0%", tier: "入门" },
  { min: 100,  max: 499,  rate: 0.012, label: "1.2%", tier: "进阶" },
  { min: 500,  max: 999,  rate: 0.013, label: "1.3%", tier: "高级" },
  { min: 1000, max: 4999, rate: 0.014, label: "1.4%", tier: "精英" },
  { min: 5000, max: Infinity, rate: 0.015, label: "1.5%", tier: "顶级", best: true },
] as const;

function getBurnRate(amount: number) {
  return BURN_TIERS.find(t => amount >= t.min && amount <= t.max) || BURN_TIERS[0];
}

interface EmberBurnPosition {
  id: string;
  runeAmount: string;
  dailyRate: string;
  pendingEmber: string;
  totalClaimedEmber: string;
  lastClaimAt: string;
  status: string;
  createdAt: string;
}

interface EmberBurnStats {
  totalRuneBurned: string;
  dailyEmber: string;
  totalClaimedEmber: string;
}

export function EmberBurnSection() {
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [runeAmount, setRuneAmount] = useState("");
  const [showTiers, setShowTiers] = useState(false);

  const { data: stats } = useQuery<EmberBurnStats>({
    queryKey: ["/api/ember-burn/stats", wallet],
    queryFn: () => fetch(`/api/ember-burn/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const { data: positions = [], isLoading: posLoading } = useQuery<EmberBurnPosition[]>({
    queryKey: ["/api/ember-burn", wallet],
    queryFn: () => fetch(`/api/ember-burn?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const burnMutation = useMutation({
    mutationFn: (data: { walletAddress: string; runeAmount: number }) =>
      apiPost("/api/ember-burn", data),
    onSuccess: () => {
      toast({ title: "销毁成功", description: `已永久销毁 ${runeAmount} RUNE，开始每日产出 EMBER` });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
      setOpen(false);
      setRuneAmount("");
      setConfirmed(false);
    },
    onError: (err: Error) => {
      toast({ title: "销毁失败", description: err.message, variant: "destructive" });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (positionId: string) =>
      apiPost("/api/ember-burn/claim", { walletAddress: wallet, positionId }),
    onSuccess: (data: any) => {
      toast({ title: "领取成功", description: `已领取 ${Number(data.claimed).toFixed(4)} EMBER` });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
    },
    onError: (err: Error) => {
      toast({ title: "领取失败", description: err.message, variant: "destructive" });
    },
  });

  const handleBurn = () => {
    const amount = parseFloat(runeAmount);
    if (!wallet) { toast({ title: "请先连接钱包", variant: "destructive" }); return; }
    if (isNaN(amount) || amount <= 0) { toast({ title: "请输入有效的 RUNE 数量", variant: "destructive" }); return; }
    if (!confirmed) { toast({ title: "请确认不可逆操作", variant: "destructive" }); return; }
    burnMutation.mutate({ walletAddress: wallet, runeAmount: amount });
  };

  const amountNum = parseFloat(runeAmount) || 0;
  const tier = getBurnRate(amountNum);
  const dailyEmber = amountNum * tier.rate;
  const yearlyEmber = dailyEmber * 365;

  const activePositions = positions.filter(p => p.status === "ACTIVE");
  const totalDailyEmber = activePositions.reduce((s, p) => s + Number(p.runeAmount) * Number(p.dailyRate), 0);

  function calcPendingEmber(pos: EmberBurnPosition) {
    const days = Math.max(0, (Date.now() - new Date(pos.lastClaimAt).getTime()) / (1000 * 60 * 60 * 24));
    return Number(pos.runeAmount) * Number(pos.dailyRate) * days;
  }

  return (
    <div className="px-4 lg:px-0 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Flame className="h-3 w-3 text-red-400" />
        </div>
        <h3 className="text-sm font-bold">销毁 RUNE · 永久产出 EMBER</h3>
        <Badge className="text-[9px] border-0 ml-auto" style={{ background: "rgba(239,68,68,0.12)", color: "rgb(248,113,113)" }}>
          永久通缩
        </Badge>
      </div>

      {/* Stats Row */}
      {wallet && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-xl p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">已销毁 RUNE</div>
            <div className="text-base font-bold tabular-nums text-red-400">
              {Number(stats?.totalRuneBurned || 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">日产 EMBER</div>
            <div className="text-base font-bold tabular-nums text-orange-400">
              {totalDailyEmber.toFixed(2)}
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">已领取 EMBER</div>
            <div className="text-base font-bold tabular-nums text-orange-300">
              {Number(stats?.totalClaimedEmber || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Mechanism Description */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}>
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">EMBER 质押权益</div>
        </div>
        {[
          { icon: Coins, label: "AI 月度收益分红", desc: "全网 AI 量化月收益按 EMBER 质押权重分配", color: "rgb(251,191,36)" },
          { icon: Trophy, label: "IDO 打新独家入场券", desc: "月度1-2个新项目，平均涨幅50倍，参与须持 EMBER", color: "rgb(167,243,208)" },
          { icon: Sparkles, label: "期货市场价值积累", desc: "外部项目竞争 EMBER 流向，稀缺 131万 硬顶", color: "rgb(196,181,253)" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{label}</div>
              <div className="text-[10px] text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Burn Rate Tiers Toggle */}
      <button
        onClick={() => setShowTiers(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-muted-foreground transition-colors hover:text-foreground"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span>日化收益分层（按销毁金额）</span>
        {showTiers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showTiers && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">销毁量 (RUNE)</th>
                <th className="text-center px-3 py-2 text-muted-foreground font-medium">档次</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">日化 EMBER</th>
              </tr>
            </thead>
            <tbody>
              {BURN_TIERS.map(t => (
                <tr key={t.min} className={cn("border-t", t.best ? "text-orange-300" : "")} style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {t.max === Infinity ? `≥ ${t.min.toLocaleString()}` : `${t.min} – ${t.max.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {t.best ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "rgb(248,113,113)" }}>顶级</span> : t.tier}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{t.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Burn Button */}
      <Button
        className="w-full h-10 text-sm font-bold"
        style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(220,38,38,0.85))", color: "#fff" }}
        onClick={() => { setOpen(true); setConfirmed(false); }}
        data-testid="button-ember-burn-open"
      >
        <Flame className="mr-2 h-4 w-4" />
        销毁 RUNE → 获得永久 EMBER 产出
      </Button>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">当前销毁仓位</div>
          {activePositions.map(pos => {
            const pending = calcPendingEmber(pos);
            const rate = getBurnRate(Number(pos.runeAmount));
            return (
              <div key={pos.id} className="rounded-lg px-3 py-2.5 text-xs"
                style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}
                data-testid={`row-ember-burn-${pos.id}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="font-bold text-sm text-red-400">{Number(pos.runeAmount).toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1">RUNE 销毁</span>
                  </div>
                  <Badge className="text-[9px] border-0" style={{ background: "rgba(239,68,68,0.12)", color: "rgb(248,113,113)" }}>
                    日化 {rate.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    待领取: <span className="text-orange-300 font-semibold">{pending.toFixed(4)} EMBER</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    style={{ background: "rgba(251,191,36,0.15)", color: "rgb(251,191,36)", border: "1px solid rgba(251,191,36,0.25)" }}
                    onClick={() => claimMutation.mutate(pos.id)}
                    disabled={claimMutation.isPending || pending < 0.001}
                    data-testid={`button-claim-ember-${pos.id}`}
                  >
                    {claimMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "领取"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!wallet && (
        <div className="text-center py-4 text-xs text-muted-foreground">连接钱包以查看销毁记录</div>
      )}

      {/* Burn Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Flame className="h-4 w-4" />
              销毁 RUNE 获得 EMBER
            </DialogTitle>
            <DialogDescription className="text-xs">
              销毁后 RUNE 永久退出流通，每日按比例产出 EMBER 并自动进入质押
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Amount Input */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">销毁数量 (RUNE)</div>
              <Input
                type="number"
                placeholder="输入要销毁的 RUNE 数量"
                value={runeAmount}
                onChange={e => { setRuneAmount(e.target.value); setConfirmed(false); }}
                className="bg-background border-border"
                data-testid="input-ember-burn-amount"
              />
            </div>

            {/* Rate Preview */}
            {amountNum > 0 && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">当前档位</span>
                  <span className="font-bold" style={{ color: tier.best ? "rgb(248,113,113)" : undefined }}>{tier.tier}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">日化率</span>
                  <span className="font-bold text-orange-400">{tier.label} / 天</span>
                </div>
                <div className="border-t border-border/40 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">每日产出 EMBER</span>
                    <span className="font-bold text-orange-300">{dailyEmber.toFixed(4)} EMBER</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">年度预估 EMBER</span>
                    <span className="font-bold text-orange-300">{yearlyEmber.toFixed(0)} EMBER</span>
                  </div>
                  {tier.best && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">10年累积 EMBER</span>
                      <span className="font-bold text-orange-200">{(yearlyEmber * 10).toFixed(0)} EMBER</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tier Reference */}
            {amountNum > 0 && amountNum < 5000 && (
              <div className="text-[10px] text-muted-foreground rounded-lg p-2" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.10)" }}>
                💡 销毁 <span className="text-yellow-400 font-semibold">5,000+ RUNE</span> 可触达 1.5% 最高日化档位
              </div>
            )}

            {/* Irreversible Warning */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[10px] rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-red-300 space-y-0.5">
                  <div className="font-semibold">⚠️ 不可逆操作</div>
                  <div>销毁后 RUNE 永久退出流通，<strong>本金无法归还</strong>。您获得的是永久日化 EMBER 产出权，无到期时间。</div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-burn-confirm"
                />
                <span className="text-[11px] text-muted-foreground">我已理解销毁不可逆，确认继续</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
            <Button
              size="sm"
              onClick={handleBurn}
              disabled={burnMutation.isPending || !runeAmount || parseFloat(runeAmount) <= 0 || !confirmed}
              style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))", color: "#fff" }}
              data-testid="button-ember-burn-confirm"
            >
              {burnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Flame className="mr-1.5 h-3.5 w-3.5" />确认销毁</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
