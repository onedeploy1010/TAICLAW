import { useState } from "react";
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
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const BURN_TIERS: Array<{ min: number; max: number; rate: number; rateLabel: string; tierKey: string; tierDefault: string; best?: boolean }> = [
  { min: 0,    max: 99,        rate: 0.010, rateLabel: "1.0%", tierKey: "vault.burn.tierStarter",  tierDefault: "Starter" },
  { min: 100,  max: 499,       rate: 0.012, rateLabel: "1.2%", tierKey: "vault.burn.tierAdvanced", tierDefault: "Advanced" },
  { min: 500,  max: 999,       rate: 0.013, rateLabel: "1.3%", tierKey: "vault.burn.tierPro",      tierDefault: "Pro" },
  { min: 1000, max: 4999,      rate: 0.014, rateLabel: "1.4%", tierKey: "vault.burn.tierElite",    tierDefault: "Elite" },
  { min: 5000, max: Infinity,  rate: 0.015, rateLabel: "1.5%", tierKey: "vault.burn.tierMax",      tierDefault: "Max", best: true },
];

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
  const { t } = useTranslation();
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

  const { data: positions = [] } = useQuery<EmberBurnPosition[]>({
    queryKey: ["/api/ember-burn", wallet],
    queryFn: () => fetch(`/api/ember-burn?wallet=${wallet}`).then(r => r.json()),
    enabled: !!wallet,
  });

  const burnMutation = useMutation({
    mutationFn: (data: { walletAddress: string; runeAmount: number }) =>
      apiPost("/api/ember-burn", data),
    onSuccess: () => {
      toast({ title: t("vault.burn.success", "Burned!"), description: t("vault.burn.successDesc", "RUNE burned successfully. Daily EMBER yield has started.") });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
      setOpen(false);
      setRuneAmount("");
      setConfirmed(false);
    },
    onError: (err: Error) => {
      toast({ title: t("vault.burn.error", "Burn Failed"), description: err.message, variant: "destructive" });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (positionId: string) =>
      apiPost("/api/ember-burn/claim", { walletAddress: wallet, positionId }),
    onSuccess: (data: any) => {
      toast({ title: t("vault.burn.claimSuccess", "Claimed!"), description: t("vault.burn.claimSuccessDesc", "Claimed {{amount}} EMBER", { amount: Number(data.claimed).toFixed(4) }) });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn", wallet] });
      queryClient.invalidateQueries({ queryKey: ["/api/ember-burn/stats", wallet] });
    },
    onError: (err: Error) => {
      toast({ title: t("vault.burn.claimError", "Claim Failed"), description: err.message, variant: "destructive" });
    },
  });

  const handleBurn = () => {
    const amount = parseFloat(runeAmount);
    if (!wallet) { toast({ title: t("vault.burn.validationWallet", "Please connect your wallet first"), variant: "destructive" }); return; }
    if (isNaN(amount) || amount <= 0) { toast({ title: t("vault.burn.validationAmount", "Please enter a valid RUNE amount"), variant: "destructive" }); return; }
    if (!confirmed) { toast({ title: t("vault.burn.validationConfirm", "Please confirm the irreversible action"), variant: "destructive" }); return; }
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

  const benefits = [
    { icon: Coins,    color: "rgb(251,191,36)",  labelKey: "vault.burn.benefitRevenue", labelDefault: "AI Revenue Share",     descKey: "vault.burn.benefitRevenueDesc", descDefault: "Monthly AI quant profits distributed by EMBER weight" },
    { icon: Trophy,   color: "rgb(167,243,208)", labelKey: "vault.burn.benefitIdo",     labelDefault: "Exclusive IDO Access", descKey: "vault.burn.benefitIdoDesc",     descDefault: "Monthly launches, avg 50x. EMBER holders only" },
    { icon: Sparkles, color: "rgb(196,181,253)", labelKey: "vault.burn.benefitScarcity",labelDefault: "Protocol Scarcity",    descKey: "vault.burn.benefitScarcityDesc",descDefault: "Hard cap 1.31M EMBER. External projects compete for emissions" },
  ];

  return (
    <div className="px-4 lg:px-0 space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Flame className="h-3 w-3 text-red-400" />
        </div>
        <h3 className="text-sm font-bold">{t("vault.burn.sectionTitle", "Burn RUNE · Permanent EMBER Yield")}</h3>
        <Badge className="text-[9px] border-0 ml-auto" style={{ background: "rgba(239,68,68,0.12)", color: "rgb(248,113,113)" }}>
          {t("vault.burn.badge", "Permanent Deflation")}
        </Badge>
      </div>

      {/* Stats Row */}
      {wallet && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { labelKey: "vault.burn.statBurned",  labelDefault: "RUNE Burned",   value: Number(stats?.totalRuneBurned || 0).toLocaleString(), color: "text-red-400" },
            { labelKey: "vault.burn.statDaily",   labelDefault: "Daily EMBER",   value: totalDailyEmber.toFixed(2),                          color: "text-orange-400" },
            { labelKey: "vault.burn.statClaimed", labelDefault: "EMBER Claimed", value: Number(stats?.totalClaimedEmber || 0).toFixed(2),    color: "text-orange-300" },
          ].map(({ labelKey, labelDefault, value, color }) => (
            <div key={labelKey} className="rounded-xl p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
              <div className="text-[9px] text-muted-foreground uppercase mb-0.5">{t(labelKey, labelDefault)}</div>
              <div className={`text-base font-bold tabular-nums ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* EMBER Benefits */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("vault.burn.benefitsTitle", "EMBER Staking Benefits")}</div>
        {benefits.map(({ icon: Icon, color, labelKey, labelDefault, descKey, descDefault }) => (
          <div key={labelKey} className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold">{t(labelKey, labelDefault)}</div>
              <div className="text-[10px] text-muted-foreground">{t(descKey, descDefault)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rate Tiers Toggle */}
      <button
        onClick={() => setShowTiers(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-muted-foreground transition-colors hover:text-foreground"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span>{t("vault.burn.tiersTitle", "Daily Rate Tiers (by burn amount)")}</span>
        {showTiers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showTiers && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierAmount", "Burn Amount (RUNE)")}</th>
                <th className="text-center px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierLevel", "Level")}</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">{t("vault.burn.tierRate", "Daily EMBER")}</th>
              </tr>
            </thead>
            <tbody>
              {BURN_TIERS.map(tier => (
                <tr key={tier.min} className={cn("border-t", tier.best ? "text-orange-300" : "")} style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {tier.max === Infinity ? `≥ ${tier.min.toLocaleString()}` : `${tier.min.toLocaleString()} – ${tier.max.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {tier.best
                      ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "rgb(248,113,113)" }}>{t(tier.tierKey, tier.tierDefault)}</span>
                      : t(tier.tierKey, tier.tierDefault)
                    }
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{tier.rateLabel}</td>
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
        {t("vault.burn.burnButton", "Burn RUNE → Permanent EMBER Yield")}
      </Button>

      {/* Active Burn Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">{t("vault.burn.myPositions", "Active Burn Positions")}</div>
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
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    style={{ background: "rgba(251,191,36,0.15)", color: "rgb(251,191,36)", border: "1px solid rgba(251,191,36,0.25)" }}
                    onClick={() => claimMutation.mutate(pos.id)}
                    disabled={claimMutation.isPending || pending < 0.001}
                    data-testid={`button-claim-ember-${pos.id}`}
                  >
                    {claimMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : t("vault.burn.claim", "Claim")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!wallet && (
        <div className="text-center py-4 text-xs text-muted-foreground">{t("vault.burn.connectWallet", "Connect wallet to view burn positions")}</div>
      )}

      {/* Burn Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Flame className="h-4 w-4" />
              {t("vault.burn.confirmTitle", "Burn RUNE for EMBER")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("vault.burn.confirmDesc", "Burned RUNE leaves circulation permanently. You receive daily EMBER yield with no expiry.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("vault.burn.amountLabel", "Burn Amount (RUNE)")}</div>
              <Input
                type="number"
                placeholder={t("vault.burn.amountPlaceholder", "Enter RUNE to burn permanently")}
                value={runeAmount}
                onChange={e => { setRuneAmount(e.target.value); setConfirmed(false); }}
                className="bg-background border-border"
                data-testid="input-ember-burn-amount"
              />
            </div>

            {amountNum > 0 && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("vault.burn.currentTier", "Current Tier")}</span>
                  <span className="font-bold" style={{ color: tier.best ? "rgb(248,113,113)" : undefined }}>{t(tier.tierKey, tier.tierDefault)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("vault.burn.dailyRateLabel", "Daily Rate")}</span>
                  <span className="font-bold text-orange-400">{tier.rateLabel} / day</span>
                </div>
                <div className="border-t border-border/40 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("vault.burn.dailyYield", "Daily EMBER Yield")}</span>
                    <span className="font-bold text-orange-300">{dailyEmber.toFixed(4)} EMBER</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("vault.burn.yearlyYield", "Annual EMBER Estimate")}</span>
                    <span className="font-bold text-orange-300">{yearlyEmber.toFixed(0)} EMBER</span>
                  </div>
                </div>
              </div>
            )}

            {amountNum > 0 && amountNum < 5000 && (
              <div className="text-[10px] text-muted-foreground rounded-lg p-2" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.10)" }}>
                💡 {t("vault.burn.tipUpgrade", "Burn 5,000+ RUNE to unlock the maximum 1.5% daily rate")}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[10px] rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-red-300 space-y-0.5">
                  <div className="font-semibold">{t("vault.burn.irreversible", "⚠️ Irreversible Action")}</div>
                  <div>{t("vault.burn.irreversibleDesc", "Burned RUNE is permanently removed from circulation. Principal is never returned. You receive perpetual daily EMBER yield.")}</div>
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
                <span className="text-[11px] text-muted-foreground">{t("vault.burn.checkboxLabel", "I understand this is irreversible and confirm")}</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button
              size="sm"
              onClick={handleBurn}
              disabled={burnMutation.isPending || !runeAmount || parseFloat(runeAmount) <= 0 || !confirmed}
              style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))", color: "#fff" }}
              data-testid="button-ember-burn-confirm"
            >
              {burnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Flame className="mr-1.5 h-3.5 w-3.5" />{t("vault.burn.confirmBtn", "Confirm Burn")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
