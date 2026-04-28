import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Lock, Zap, Vote, TrendingUp, Star, Clock, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const LOCK_PERIODS = [
  { days: 30,  label: "30天",  multiplier: 0.0556, bonus: "",     color: "rgba(100,116,139,0.7)" },
  { days: 90,  label: "90天",  multiplier: 0.1667, bonus: "",     color: "rgba(59,130,246,0.8)" },
  { days: 180, label: "180天", multiplier: 0.3333, bonus: "",     color: "rgba(168,85,247,0.8)" },
  { days: 360, label: "360天", multiplier: 0.6667, bonus: "+20%", color: "rgba(212,168,50,0.8)" },
  { days: 540, label: "540天", multiplier: 1.0,    bonus: "满配", color: "rgba(239,68,68,0.8)", best: true },
] as const;

function calcVeRune(runeAmount: number, lockDays: number) {
  return runeAmount * 0.35 * (lockDays / 540);
}

function calcVeRunePct(lockDays: number) {
  return ((lockDays / 540) * 35).toFixed(2);
}

interface RuneLockPosition {
  id: string;
  runeAmount: string;
  lockDays: number;
  veRune: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface RuneLockStats {
  totalRuneLocked: string;
  totalVeRune: string;
  positions: number;
}

export function RuneLockSection() {
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [runeAmount, setRuneAmount] = useState("");
  const [selectedDays, setSelectedDays] = useState(540);

  const { data: stats } = useQuery<RuneLockStats>({
    queryKey: ["/api/rune-lock/stats", wallet],
    queryFn: () => fetch(`/api/rune-lock/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const { data: positions = [], isLoading: posLoading } = useQuery<RuneLockPosition[]>({
    queryKey: ["/api/rune-lock", wallet],
    queryFn: () => fetch(`/api/rune-lock?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const lockMutation = useMutation({
    mutationFn: (data: { walletAddress: string; runeAmount: number; lockDays: number }) =>
      apiPost("/api/rune-lock", data),
    onSuccess: () => {
      toast({ title: "锁仓成功", description: `已成功锁仓 ${runeAmount} RUNE，获得 veRUNE 权益` });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock/stats", wallet] });
      setOpen(false);
      setRuneAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "锁仓失败", description: err.message, variant: "destructive" });
    },
  });

  const handleLock = () => {
    const amount = parseFloat(runeAmount);
    if (!wallet) { toast({ title: "请先连接钱包", variant: "destructive" }); return; }
    if (isNaN(amount) || amount <= 0) { toast({ title: "请输入有效的 RUNE 数量", variant: "destructive" }); return; }
    lockMutation.mutate({ walletAddress: wallet, runeAmount: amount, lockDays: selectedDays });
  };

  const amountNum = parseFloat(runeAmount) || 0;
  const selectedPeriod = LOCK_PERIODS.find(p => p.days === selectedDays) || LOCK_PERIODS[4];
  const previewVeRune = calcVeRune(amountNum, selectedDays);

  const activePositions = positions.filter(p => p.status === "ACTIVE");

  return (
    <div className="px-4 lg:px-0 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.3)" }}>
          <Lock className="h-3 w-3" style={{ color: "rgba(212,168,50,0.9)" }} />
        </div>
        <h3 className="text-sm font-bold">锁仓 RUNE · 获得 veRUNE</h3>
        <Badge className="text-[9px] border-0 ml-auto" style={{ background: "rgba(212,168,50,0.15)", color: "rgba(212,168,50,0.9)" }}>
          ve(3,3) 机制
        </Badge>
      </div>

      {/* Stats Row */}
      {wallet && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3" style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.15)" }}>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">已锁仓 RUNE</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: "rgba(212,168,50,0.9)" }}>
              {Number(stats?.totalRuneLocked || 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.15)" }}>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">我的 veRUNE</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: "rgba(212,168,50,0.9)" }}>
              {Number(stats?.totalVeRune || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(212,168,50,0.04)", border: "1px solid rgba(212,168,50,0.10)" }}>
        <div className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">veRUNE 四大权益</div>
        {[
          { icon: Vote, label: "Epoch 投票权", desc: "每14天决定 EMBER 流向，参与治理", color: "rgba(168,85,247,0.8)" },
          { icon: TrendingUp, label: "量化收益分红", desc: "Forge AI 月收益按 veRUNE 权重分配 USDT", color: "rgba(34,197,94,0.8)" },
          { icon: Star, label: "IDO 打新配额", desc: "月度1-2个新项目，平均涨幅50倍", color: "rgba(212,168,50,0.9)" },
          { icon: Zap, label: "期货收益权", desc: "外部项目竞争 EMBER 流向，收益100%分配", color: "rgba(59,130,246,0.8)" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{label}</div>
              <div className="text-[10px] text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* veRUNE Formula Preview */}
      <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[9px] text-muted-foreground mb-1">veRUNE 计算公式</div>
        <div className="font-mono text-[10px] text-muted-foreground/80">
          veRUNE = RUNE数量 × 35% × (锁定天数 ÷ 540)
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] text-muted-foreground">锁540天满配 = <span style={{ color: "rgba(212,168,50,0.9)" }}>veRUNE权重最大</span></div>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        </div>
      </div>

      {/* Lock Periods */}
      <div className="grid grid-cols-5 gap-1.5">
        {LOCK_PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setSelectedDays(p.days)}
            className={cn("rounded-lg py-2 px-1 text-center transition-all relative", selectedDays === p.days ? "ring-1" : "opacity-60 hover:opacity-80")}
            style={{
              background: selectedDays === p.days ? `${p.color}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedDays === p.days ? p.color : "rgba(255,255,255,0.08)"}`,
              ringColor: p.color,
            }}
            data-testid={`button-lock-period-${p.days}`}
          >
            {p.best && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] px-1 rounded" style={{ background: p.color, color: "#000" }}>最佳</span>}
            <div className="text-[10px] font-bold" style={{ color: selectedDays === p.days ? p.color : undefined }}>{p.label}</div>
            <div className="text-[8px] text-muted-foreground mt-0.5">{calcVeRunePct(p.days)}%</div>
            {p.bonus && <div className="text-[8px] mt-0.5" style={{ color: p.color }}>{p.bonus}</div>}
          </button>
        ))}
      </div>

      {/* Lock Button */}
      <Button
        className="w-full h-10 text-sm font-bold"
        style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.9), rgba(180,130,30,0.9))", color: "#0a0704" }}
        onClick={() => setOpen(true)}
        data-testid="button-rune-lock-open"
      >
        <Lock className="mr-2 h-4 w-4" />
        锁仓 RUNE 获得 veRUNE
      </Button>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">当前锁仓</div>
          {activePositions.map(pos => {
            const daysLeft = Math.max(0, Math.ceil((new Date(pos.endDate).getTime() - Date.now()) / 86400000));
            const period = LOCK_PERIODS.find(p => p.days === pos.lockDays);
            return (
              <div key={pos.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs"
                style={{ background: "rgba(212,168,50,0.04)", border: "1px solid rgba(212,168,50,0.12)" }}
                data-testid={`row-rune-lock-${pos.id}`}
              >
                <div>
                  <span className="font-bold text-sm">{Number(pos.runeAmount).toLocaleString()}</span>
                  <span className="text-muted-foreground ml-1.5">RUNE</span>
                  <span className="ml-2 text-[10px]" style={{ color: period?.color || "rgba(212,168,50,0.9)" }}>{pos.lockDays}天</span>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: "rgba(212,168,50,0.9)" }}>{Number(pos.veRune).toFixed(2)} veRUNE</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    <span>剩余 {daysLeft} 天</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!wallet && (
        <div className="text-center py-4 text-xs text-muted-foreground">连接钱包以查看锁仓记录</div>
      )}

      {/* Lock Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: "rgba(212,168,50,0.9)" }} />
              锁仓 RUNE
            </DialogTitle>
            <DialogDescription className="text-xs">
              锁仓后获得 veRUNE，享受 AI 分红、IDO 打新、治理投票四大权益
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Amount Input */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">锁仓数量 (RUNE)</div>
              <Input
                type="number"
                placeholder="输入 RUNE 数量"
                value={runeAmount}
                onChange={e => setRuneAmount(e.target.value)}
                className="bg-background border-border"
                data-testid="input-rune-lock-amount"
              />
            </div>

            {/* Period Selection */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">锁定周期</div>
              <div className="grid grid-cols-5 gap-1">
                {LOCK_PERIODS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setSelectedDays(p.days)}
                    className={cn("rounded-lg py-1.5 text-center text-[10px] font-bold transition-all", selectedDays === p.days ? "ring-1" : "opacity-50 hover:opacity-70")}
                    style={{
                      background: selectedDays === p.days ? `${p.color}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selectedDays === p.days ? p.color : "rgba(255,255,255,0.08)"}`,
                      color: selectedDays === p.days ? p.color : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {amountNum > 0 && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(212,168,50,0.05)", border: "1px solid rgba(212,168,50,0.15)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">锁定 RUNE</span>
                  <span className="font-bold">{amountNum.toLocaleString()} RUNE</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">锁定周期</span>
                  <span className="font-bold">{selectedPeriod.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2">
                  <span className="text-muted-foreground">获得 veRUNE</span>
                  <span className="font-bold text-sm" style={{ color: "rgba(212,168,50,0.9)" }}>
                    {previewVeRune.toFixed(4)} veRUNE
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">veRUNE 权重</span>
                  <span className="font-semibold" style={{ color: "rgba(212,168,50,0.9)" }}>
                    {calcVeRunePct(selectedDays)}% of 满配
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg p-2" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
              <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
              <span>锁定期间无法提取 RUNE，到期后自动解锁。veRUNE 线性衰减，续期可重置权重。</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
            <Button
              size="sm"
              onClick={handleLock}
              disabled={lockMutation.isPending || !runeAmount || parseFloat(runeAmount) <= 0}
              style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.9), rgba(180,130,30,0.9))", color: "#0a0704" }}
              data-testid="button-rune-lock-confirm"
            >
              {lockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认锁仓"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
