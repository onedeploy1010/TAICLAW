import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Lock, Zap, Vote, TrendingUp, Star, Clock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { usePayment, getPaymentStatusLabel } from "@/hooks/use-payment";
import { useMaPrice } from "@/hooks/use-ma-price";
import { RUNE_LOCK_CONTRACT_ADDRESS } from "@/lib/contracts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const LOCK_PERIODS: Array<{ days: number; label: string; pctLabel: string; color: string; best?: boolean }> = [
  { days: 30,  label: "30D",  pctLabel: "6.5%",  color: "rgba(100,116,139,0.7)" },
  { days: 90,  label: "90D",  pctLabel: "16.7%", color: "rgba(59,130,246,0.8)" },
  { days: 180, label: "180D", pctLabel: "33.3%", color: "rgba(168,85,247,0.8)" },
  { days: 360, label: "360D", pctLabel: "66.7%", color: "rgba(212,168,50,0.8)" },
  { days: 540, label: "540D", pctLabel: "100%",  color: "rgba(239,68,68,0.8)", best: true },
];

interface RuneLockPosition {
  id: string;
  usdtAmount?: string;
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
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();
  const payment = usePayment();
  const { price: runePrice, usdcToMA } = useMaPrice();

  const [open, setOpen] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [selectedDays, setSelectedDays] = useState(540);

  const { data: stats } = useQuery<RuneLockStats>({
    queryKey: ["/api/rune-lock/stats", wallet],
    queryFn: () => fetch(`/api/rune-lock/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const { data: positions = [] } = useQuery<RuneLockPosition[]>({
    queryKey: ["/api/rune-lock", wallet],
    queryFn: () => fetch(`/api/rune-lock?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const lockMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; usdtAmount: number; runeAmount: number; lockDays: number }) => {
      let txHash: string | undefined;
      if (RUNE_LOCK_CONTRACT_ADDRESS) {
        try {
          txHash = await payment.payRuneLock(data.usdtAmount);
        } catch (e: any) {
          if (!e.message?.includes("not configured")) throw e;
        }
      }
      payment.markSuccess();
      return apiPost("/api/rune-lock", {
        walletAddress: data.walletAddress,
        usdtAmount: data.usdtAmount,
        runeAmount: data.runeAmount,
        runePrice,
        lockDays: data.lockDays,
        txHash: txHash || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("vault.lock.success", "Locked!"), description: t("vault.lock.successDesc", "RUNE locked. veRUNE benefits are now active.") });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/rune-lock/stats", wallet] });
      setOpen(false);
      setUsdtAmount("");
      payment.reset();
    },
    onError: (err: Error) => {
      toast({ title: t("vault.lock.error", "Lock Failed"), description: err.message, variant: "destructive" });
      payment.reset();
    },
  });

  const handleLock = () => {
    const usdt = parseFloat(usdtAmount);
    if (!wallet) { toast({ title: t("vault.lock.validationWallet", "Connect wallet first"), variant: "destructive" }); return; }
    if (isNaN(usdt) || usdt < 10) { toast({ title: t("vault.lock.validationAmount", "Minimum 10 USDT"), variant: "destructive" }); return; }
    const rune = usdcToMA(usdt);
    lockMutation.mutate({ walletAddress: wallet, usdtAmount: usdt, runeAmount: rune, lockDays: selectedDays });
  };

  const usdtNum = parseFloat(usdtAmount) || 0;
  const runeEquiv = usdcToMA(usdtNum);
  const selectedPeriod = LOCK_PERIODS.find(p => p.days === selectedDays) || LOCK_PERIODS[4];
  const veRunePreview = runeEquiv * 0.35 * (selectedDays / 540);
  const activePositions = positions.filter(p => p.status === "ACTIVE");

  const isPaying = lockMutation.isPending;
  const payLabel = payment.status !== "idle" ? getPaymentStatusLabel(payment.status) : t("vault.lock.confirmBtn", "Confirm & Pay");

  const benefits = [
    { icon: Vote,       color: "rgba(168,85,247,0.8)", lk: "vault.lock.benefitVoting",   ld: "Epoch Voting",        dk: "vault.lock.benefitVotingDesc",   dd: "Direct EMBER emissions every 14 days" },
    { icon: TrendingUp, color: "rgba(34,197,94,0.8)",  lk: "vault.lock.benefitDividend", ld: "AI Revenue Share",    dk: "vault.lock.benefitDividendDesc", dd: "Monthly USDT dividends weighted by veRUNE" },
    { icon: Star,       color: "rgba(212,168,50,0.9)", lk: "vault.lock.benefitIdo",      ld: "IDO Launch Access",   dk: "vault.lock.benefitIdoDesc",      dd: "Monthly projects, avg 50x returns" },
    { icon: Zap,        color: "rgba(59,130,246,0.8)", lk: "vault.lock.benefitForge",    ld: "Forge Fee Dividends", dk: "vault.lock.benefitForgeDesc",    dd: "External protocols compete for EMBER flow" },
  ];

  return (
    <div className="px-4 lg:px-0 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.3)" }}>
          <Lock className="h-3 w-3" style={{ color: "rgba(212,168,50,0.9)" }} />
        </div>
        <h3 className="text-sm font-bold">{t("vault.lock.sectionTitle", "Lock RUNE · Earn veRUNE")}</h3>
        <Badge className="text-[9px] border-0 ml-auto" style={{ background: "rgba(212,168,50,0.15)", color: "rgba(212,168,50,0.9)" }}>
          {t("vault.lock.badge", "ve(3,3) Model")}
        </Badge>
      </div>

      {/* Stats */}
      {wallet && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { lk: "vault.lock.stakedRune", ld: "RUNE Locked", v: Number(stats?.totalRuneLocked || 0).toLocaleString() },
            { lk: "vault.lock.myVeRune",   ld: "My veRUNE",   v: Number(stats?.totalVeRune || 0).toFixed(2) },
          ].map(({ lk, ld, v }) => (
            <div key={lk} className="rounded-xl p-3" style={{ background: "rgba(212,168,50,0.06)", border: "1px solid rgba(212,168,50,0.15)" }}>
              <div className="text-[9px] text-muted-foreground uppercase mb-0.5">{t(lk, ld)}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: "rgba(212,168,50,0.9)" }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Benefits */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(212,168,50,0.04)", border: "1px solid rgba(212,168,50,0.10)" }}>
        <div className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">{t("vault.lock.benefitsTitle", "veRUNE Benefits")}</div>
        {benefits.map(({ icon: Icon, color, lk, ld, dk, dd }) => (
          <div key={lk} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{t(lk, ld)}</div>
              <div className="text-[10px] text-muted-foreground">{t(dk, dd)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Formula */}
      <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[9px] text-muted-foreground mb-1">{t("vault.lock.formulaTitle", "veRUNE Formula")}</div>
        <div className="font-mono text-[10px] text-muted-foreground/80">{t("vault.lock.formulaExpr", "veRUNE = RUNE × 35% × (lock days ÷ 540)")}</div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <span>{t("vault.lock.formulaNote", "Lock 540 days")} = <span style={{ color: "rgba(212,168,50,0.9)" }}>{t("vault.lock.maxWeight", "maximum veRUNE weight")}</span></span>
        </div>
      </div>

      {/* Period Selector */}
      <div className="grid grid-cols-5 gap-1.5">
        {LOCK_PERIODS.map(p => (
          <button key={p.days} onClick={() => setSelectedDays(p.days)}
            className={cn("rounded-lg py-2 px-1 text-center transition-all relative", selectedDays === p.days ? "ring-1" : "opacity-60 hover:opacity-80")}
            style={{ background: selectedDays === p.days ? `${p.color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${selectedDays === p.days ? p.color : "rgba(255,255,255,0.08)"}` }}
            data-testid={`button-lock-period-${p.days}`}
          >
            {p.best && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] px-1 rounded font-bold" style={{ background: p.color, color: "#000" }}>{t("vault.lock.best", "Best")}</span>}
            <div className="text-[10px] font-bold" style={{ color: selectedDays === p.days ? p.color : undefined }}>{p.label}</div>
            <div className="text-[8px] text-muted-foreground mt-0.5">{p.pctLabel}</div>
          </button>
        ))}
      </div>

      {/* Lock Button */}
      <Button className="w-full h-10 text-sm font-bold" style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.9), rgba(180,130,30,0.9))", color: "#0a0704" }}
        onClick={() => setOpen(true)} data-testid="button-rune-lock-open">
        <Lock className="mr-2 h-4 w-4" />
        {t("vault.lock.lockButton", "Pay USDT · Lock RUNE for veRUNE")}
      </Button>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">{t("vault.lock.myLocks", "Active Locks")}</div>
          {activePositions.map(pos => {
            const daysLeft = Math.max(0, Math.ceil((new Date(pos.endDate).getTime() - Date.now()) / 86400000));
            const period = LOCK_PERIODS.find(p => p.days === pos.lockDays);
            return (
              <div key={pos.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs"
                style={{ background: "rgba(212,168,50,0.04)", border: "1px solid rgba(212,168,50,0.12)" }}
                data-testid={`row-rune-lock-${pos.id}`}>
                <div>
                  {pos.usdtAmount && <><span className="text-[10px] text-muted-foreground">$</span><span className="font-bold">{Number(pos.usdtAmount).toFixed(0)} USDT</span><span className="mx-1.5 text-muted-foreground">→</span></>}
                  <span className="font-bold">{Number(pos.runeAmount).toLocaleString()}</span>
                  <span className="text-muted-foreground ml-1">RUNE</span>
                  <span className="ml-2 text-[10px]" style={{ color: period?.color || "rgba(212,168,50,0.9)" }}>{pos.lockDays}D</span>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: "rgba(212,168,50,0.9)" }}>{Number(pos.veRune).toFixed(2)} veRUNE</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{t("vault.lock.daysLeft", "{{days}}d left", { days: daysLeft })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!wallet && <div className="text-center py-4 text-xs text-muted-foreground">{t("vault.lock.connectWallet", "Connect wallet to view your locks")}</div>}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!isPaying) { setOpen(v); if (!v) payment.reset(); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: "rgba(212,168,50,0.9)" }} />
              {t("vault.lock.confirmTitle", "Lock RUNE for veRUNE")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("vault.lock.confirmDesc", "Pay USDT → buy RUNE at market price → lock for veRUNE benefits")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* USDT Input */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("vault.lock.amountLabel", "USDT Amount")}</div>
              <div className="relative">
                <Input type="number" placeholder={t("vault.lock.amountPlaceholder", "Min 10 USDT")}
                  value={usdtAmount} onChange={e => setUsdtAmount(e.target.value)}
                  className="bg-background border-border pr-16" data-testid="input-rune-lock-amount" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">USDT</span>
              </div>
            </div>

            {/* Conversion Preview */}
            {usdtNum >= 10 && (
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(212,168,50,0.05)", border: "1px solid rgba(212,168,50,0.15)" }}>
                {/* Arrow flow */}
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="font-bold">${usdtNum.toFixed(2)} USDT</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold" style={{ color: "rgba(212,168,50,0.9)" }}>{runeEquiv.toFixed(2)} RUNE</span>
                  <span className="text-[10px] text-muted-foreground">(@ ${runePrice.toFixed(4)})</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold text-green-400">{veRunePreview.toFixed(4)} veRUNE</span>
                </div>
                <div className="border-t border-border/30 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.lock.previewPeriod", "Lock Period")}</span><span className="font-semibold">{selectedPeriod.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.lock.previewWeight", "veRUNE Weight")}</span><span className="font-semibold" style={{ color: "rgba(212,168,50,0.9)" }}>{selectedPeriod.pctLabel}</span></div>
                </div>
              </div>
            )}

            {/* Period Selector in dialog */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("vault.lock.periodLabel", "Lock Period")}</div>
              <div className="grid grid-cols-5 gap-1">
                {LOCK_PERIODS.map(p => (
                  <button key={p.days} onClick={() => setSelectedDays(p.days)}
                    className={cn("rounded-lg py-1.5 text-center text-[10px] font-bold transition-all", selectedDays === p.days ? "ring-1" : "opacity-50 hover:opacity-70")}
                    style={{ background: selectedDays === p.days ? `${p.color}20` : "rgba(255,255,255,0.04)", border: `1px solid ${selectedDays === p.days ? p.color : "rgba(255,255,255,0.08)"}`, color: selectedDays === p.days ? p.color : undefined }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg p-2" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
              <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
              <span>{t("vault.lock.warning", "RUNE cannot be withdrawn during the lock period. veRUNE decays linearly — extend to reset weight.")}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); payment.reset(); }} disabled={isPaying}>{t("common.cancel", "Cancel")}</Button>
            <Button size="sm" onClick={handleLock} disabled={isPaying || !usdtAmount || parseFloat(usdtAmount) < 10}
              style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.9), rgba(180,130,30,0.9))", color: "#0a0704" }}
              data-testid="button-rune-lock-confirm">
              {isPaying ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{payLabel}</> : t("vault.lock.confirmBtn", "Confirm & Pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
