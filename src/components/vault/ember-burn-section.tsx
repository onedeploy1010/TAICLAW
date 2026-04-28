import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Flame, Sparkles, Trophy, Coins, AlertCircle, Loader2, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { usePayment, getPaymentStatusLabel } from "@/hooks/use-payment";
import { useMaPrice } from "@/hooks/use-ma-price";
import { EMBER_BURN_CONTRACT_ADDRESS } from "@/lib/contracts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const BURN_TIERS: Array<{ minRune: number; maxRune: number; rate: number; rateLabel: string; tierKey: string; tierDefault: string; best?: boolean }> = [
  { minRune: 0,    maxRune: 99,       rate: 0.010, rateLabel: "1.0%", tierKey: "vault.burn.tierStarter",  tierDefault: "Starter" },
  { minRune: 100,  maxRune: 499,      rate: 0.012, rateLabel: "1.2%", tierKey: "vault.burn.tierAdvanced", tierDefault: "Advanced" },
  { minRune: 500,  maxRune: 999,      rate: 0.013, rateLabel: "1.3%", tierKey: "vault.burn.tierPro",      tierDefault: "Pro" },
  { minRune: 1000, maxRune: 4999,     rate: 0.014, rateLabel: "1.4%", tierKey: "vault.burn.tierElite",    tierDefault: "Elite" },
  { minRune: 5000, maxRune: Infinity, rate: 0.015, rateLabel: "1.5%", tierKey: "vault.burn.tierMax",      tierDefault: "Max", best: true },
];

function getBurnRate(runeAmount: number) {
  return BURN_TIERS.find(t => runeAmount >= t.minRune && runeAmount <= t.maxRune) || BURN_TIERS[0];
}

interface EmberBurnPosition {
  id: string;
  usdtAmount?: string;
  runeAmount: string;
  dailyRate: string;
  totalClaimedEmber: string;
  lastClaimAt: string;
  status: string;
}

interface EmberBurnStats {
  totalRuneBurned: string;
  dailyEmber: string;
  totalClaimedEmber: string;
}

export function EmberBurnSection() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const wallet = account?.address || "";
  const { toast } = useToast();
  const payment = usePayment();
  const { price: runePrice, usdcToMA } = useMaPrice();

  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [showTiers, setShowTiers] = useState(false);

  const { data: stats } = useQuery<EmberBurnStats>({
    queryKey: ["/api/ember-burn/stats", wallet],
    queryFn: () => fetch(`/api/ember-burn/stats?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const { data: positions = [] } = useQuery<EmberBurnPosition[]>({
    queryKey: ["/api/ember-burn", wallet],
    queryFn: () => fetch(`/api/ember-burn?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const burnMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; usdtAmount: number; runeAmount: number }) => {
      let txHash: string | undefined;
      if (EMBER_BURN_CONTRACT_ADDRESS) {
        try {
          txHash = await payment.payEmberBurn(data.usdtAmount);
        } catch (e: any) {
          if (!e.message?.includes("not configured")) throw e;
        }
      }
      payment.markSuccess();
      return apiPost("/api/ember-burn", {
        walletAddress: data.walletAddress,
        usdtAmount: data.usdtAmount,
        runeAmount: data.runeAmount,
        runePrice,
        txHash: txHash || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("vault.burn.success", "Burned!"), description: t("vault.burn.successDesc", "Daily EMBER yield has started.") });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
      setOpen(false);
      setUsdtAmount("");
      setConfirmed(false);
      payment.reset();
    },
    onError: (err: Error) => {
      toast({ title: t("vault.burn.error", "Burn Failed"), description: err.message, variant: "destructive" });
      payment.reset();
    },
  });

  const claimMutation = useMutation({
    mutationFn: (positionId: string) => apiPost("/api/ember-burn/claim", { walletAddress: wallet, positionId }),
    onSuccess: (data: any) => {
      toast({ title: t("vault.burn.claimSuccess", "Claimed!"), description: t("vault.burn.claimSuccessDesc", "Claimed {{amount}} EMBER", { amount: Number(data.claimed).toFixed(4) }) });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
    },
    onError: (err: Error) => { toast({ title: t("vault.burn.claimError", "Claim Failed"), description: err.message, variant: "destructive" }); },
  });

  const handleBurn = () => {
    const usdt = parseFloat(usdtAmount);
    if (!wallet) { toast({ title: t("vault.burn.validationWallet", "Connect wallet first"), variant: "destructive" }); return; }
    if (isNaN(usdt) || usdt < 10) { toast({ title: t("vault.burn.validationAmount", "Minimum 10 USDT"), variant: "destructive" }); return; }
    if (!confirmed) { toast({ title: t("vault.burn.validationConfirm", "Please confirm the irreversible action"), variant: "destructive" }); return; }
    const rune = usdcToMA(usdt);
    burnMutation.mutate({ walletAddress: wallet, usdtAmount: usdt, runeAmount: rune });
  };

  const usdtNum = parseFloat(usdtAmount) || 0;
  const runeEquiv = usdcToMA(usdtNum);
  const tier = getBurnRate(runeEquiv);
  const dailyEmber = runeEquiv * tier.rate;
  const yearlyEmber = dailyEmber * 365;

  const activePositions = positions.filter(p => p.status === "ACTIVE");
  const totalDailyEmber = activePositions.reduce((s, p) => s + Number(p.runeAmount) * Number(p.dailyRate), 0);

  function calcPendingEmber(pos: EmberBurnPosition) {
    const days = Math.max(0, (Date.now() - new Date(pos.lastClaimAt).getTime()) / (1000 * 60 * 60 * 24));
    return Number(pos.runeAmount) * Number(pos.dailyRate) * days;
  }

  const isPaying = burnMutation.isPending;
  const payLabel = payment.status !== "idle" ? getPaymentStatusLabel(payment.status) : t("vault.burn.confirmBtn", "Confirm Burn");

  const benefits = [
    { icon: Coins,    color: "rgb(251,191,36)",  lk: "vault.burn.benefitRevenue",  ld: "AI Revenue Share",     dk: "vault.burn.benefitRevenueDesc",  dd: "Monthly AI quant profits by EMBER weight" },
    { icon: Trophy,   color: "rgb(167,243,208)", lk: "vault.burn.benefitIdo",      ld: "Exclusive IDO Access", dk: "vault.burn.benefitIdoDesc",      dd: "Monthly launches, avg 50x. EMBER holders only" },
    { icon: Sparkles, color: "rgb(196,181,253)", lk: "vault.burn.benefitScarcity", ld: "Protocol Scarcity",    dk: "vault.burn.benefitScarcityDesc", dd: "Hard cap 1.31M EMBER. External projects compete" },
  ];

  return (
    <div className="px-4 lg:px-0 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Flame className="h-3 w-3 text-red-400" />
        </div>
        <h3 className="text-sm font-bold">{t("vault.burn.sectionTitle", "Burn RUNE · Permanent EMBER Yield")}</h3>
        <Badge className="text-[9px] border-0 ml-auto" style={{ background: "rgba(239,68,68,0.12)", color: "rgb(248,113,113)" }}>
          {t("vault.burn.badge", "Permanent Deflation")}
        </Badge>
      </div>

      {/* Stats */}
      {wallet && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { lk: "vault.burn.statBurned",  ld: "RUNE Burned",   v: Number(stats?.totalRuneBurned || 0).toLocaleString(), color: "text-red-400" },
            { lk: "vault.burn.statDaily",   ld: "Daily EMBER",   v: totalDailyEmber.toFixed(2),                          color: "text-orange-400" },
            { lk: "vault.burn.statClaimed", ld: "EMBER Claimed", v: Number(stats?.totalClaimedEmber || 0).toFixed(2),    color: "text-orange-300" },
          ].map(({ lk, ld, v, color }) => (
            <div key={lk} className="rounded-xl p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
              <div className="text-[9px] text-muted-foreground uppercase mb-0.5">{t(lk, ld)}</div>
              <div className={`text-base font-bold tabular-nums ${color}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Benefits */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("vault.burn.benefitsTitle", "EMBER Staking Benefits")}</div>
        {benefits.map(({ icon: Icon, color, lk, ld, dk, dd }) => (
          <div key={lk} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{t(lk, ld)}</div>
              <div className="text-[10px] text-muted-foreground">{t(dk, dd)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rate Tiers */}
      <button onClick={() => setShowTiers(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <span>{t("vault.burn.tiersTitle", "Daily Rate Tiers (by RUNE amount burned)")}</span>
        {showTiers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showTiers && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-[10px]">
            <thead><tr style={{ background: "rgba(255,255,255,0.04)" }}>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierAmount", "RUNE Burned")}</th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierLevel", "Level")}</th>
              <th className="text-right px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierRate", "Daily")}</th>
            </tr></thead>
            <tbody>
              {BURN_TIERS.map(t2 => (
                <tr key={t2.minRune} className={cn("border-t", t2.best ? "text-orange-300" : "")} style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {t2.maxRune === Infinity ? `≥ ${t2.minRune.toLocaleString()}` : `${t2.minRune.toLocaleString()} – ${t2.maxRune.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {t2.best
                      ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "rgb(248,113,113)" }}>{t(t2.tierKey, t2.tierDefault)}</span>
                      : t(t2.tierKey, t2.tierDefault)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{t2.rateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Burn Button */}
      <Button className="w-full h-10 text-sm font-bold"
        style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(220,38,38,0.85))", color: "#fff" }}
        onClick={() => { setOpen(true); setConfirmed(false); }} data-testid="button-ember-burn-open">
        <Flame className="mr-2 h-4 w-4" />
        {t("vault.burn.burnButton", "Pay USDT · Burn RUNE → EMBER Yield")}
      </Button>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">{t("vault.burn.myPositions", "Active Burn Positions")}</div>
          {activePositions.map(pos => {
            const pending = calcPendingEmber(pos);
            const rate = getBurnRate(Number(pos.runeAmount));
            return (
              <div key={pos.id} className="rounded-lg px-3 py-2.5 text-xs"
                style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}
                data-testid={`row-ember-burn-${pos.id}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    {pos.usdtAmount && <><span className="text-[10px] text-muted-foreground">$</span><span className="font-bold">{Number(pos.usdtAmount).toFixed(0)} USDT</span><span className="mx-1.5 text-muted-foreground">→</span></>}
                    <span className="font-bold text-sm text-red-400">{Number(pos.runeAmount).toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1">{t("vault.burn.burned", "RUNE burned")}</span>
                  </div>
                  <Badge className="text-[9px] border-0" style={{ background: "rgba(239,68,68,0.12)", color: "rgb(248,113,113)" }}>
                    {t("vault.burn.dailyRate", "Daily")} {rate.rateLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    {t("vault.burn.pending", "Pending:")} <span className="text-orange-300 font-semibold">{pending.toFixed(4)} EMBER</span>
                  </div>
                  <Button size="sm" className="h-6 text-[10px] px-2"
                    style={{ background: "rgba(251,191,36,0.15)", color: "rgb(251,191,36)", border: "1px solid rgba(251,191,36,0.25)" }}
                    onClick={() => claimMutation.mutate(pos.id)}
                    disabled={claimMutation.isPending || pending < 0.001}
                    data-testid={`button-claim-ember-${pos.id}`}>
                    {claimMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : t("vault.burn.claim", "Claim")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!wallet && <div className="text-center py-4 text-xs text-muted-foreground">{t("vault.burn.connectWallet", "Connect wallet to view burn positions")}</div>}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!isPaying) { setOpen(v); if (!v) { payment.reset(); setConfirmed(false); } } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Flame className="h-4 w-4" />
              {t("vault.burn.confirmTitle", "Burn RUNE for EMBER")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("vault.burn.confirmDesc", "Pay USDT → buy RUNE at market price → burn permanently for daily EMBER yield")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* USDT Input */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("vault.burn.amountLabel", "USDT Amount")}</div>
              <div className="relative">
                <Input type="number" placeholder={t("vault.burn.amountPlaceholder", "Min 10 USDT")}
                  value={usdtAmount} onChange={e => { setUsdtAmount(e.target.value); setConfirmed(false); }}
                  className="bg-background border-border pr-16" data-testid="input-ember-burn-amount" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">USDT</span>
              </div>
            </div>

            {/* Conversion Preview */}
            {usdtNum >= 10 && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                {/* Arrow flow */}
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="font-bold">${usdtNum.toFixed(2)} USDT</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold text-red-400">{runeEquiv.toFixed(2)} RUNE</span>
                  <span className="text-[10px] text-muted-foreground">(@ ${runePrice.toFixed(4)})</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-bold text-orange-400">{t("vault.burn.burned", "burned")}</span>
                </div>
                <div className="border-t border-border/30 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.burn.currentTier", "Tier")}</span><span className="font-semibold" style={{ color: tier.best ? "rgb(248,113,113)" : undefined }}>{t(tier.tierKey, tier.tierDefault)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.burn.dailyRateLabel", "Rate")}</span><span className="font-bold text-orange-400">{tier.rateLabel}/day</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.burn.dailyYield", "Daily EMBER")}</span><span className="font-semibold text-orange-300">{dailyEmber.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("vault.burn.yearlyYield", "Annual Est.")}</span><span className="font-semibold text-orange-300">{yearlyEmber.toFixed(0)}</span></div>
                </div>
                {runeEquiv < 5000 && (
                  <div className="text-[9px] text-muted-foreground mt-1">
                    💡 {t("vault.burn.tipUpgrade", "Spend more to reach higher tiers — max rate 1.5% at 5,000+ RUNE")}
                  </div>
                )}
              </div>
            )}

            {/* Irreversible warning + checkbox */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[10px] rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-red-300 space-y-0.5">
                  <div className="font-semibold">{t("vault.burn.irreversible", "⚠️ Irreversible Action")}</div>
                  <div>{t("vault.burn.irreversibleDesc", "RUNE is permanently removed from circulation. Principal cannot be returned. You receive perpetual daily EMBER yield.")}</div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" data-testid="checkbox-burn-confirm" />
                <span className="text-[11px] text-muted-foreground">{t("vault.burn.checkboxLabel", "I understand this is irreversible and confirm")}</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); payment.reset(); setConfirmed(false); }} disabled={isPaying}>{t("common.cancel", "Cancel")}</Button>
            <Button size="sm" onClick={handleBurn}
              disabled={isPaying || !usdtAmount || parseFloat(usdtAmount) < 10 || !confirmed}
              style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))", color: "#fff" }}
              data-testid="button-ember-burn-confirm">
              {isPaying ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{payLabel}</> : <><Flame className="mr-1.5 h-3.5 w-3.5" />{t("vault.burn.confirmBtn", "Confirm Burn")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
