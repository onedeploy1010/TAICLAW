import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useActiveAccount } from "thirdweb/react";
import { useMaPrice } from "@/hooks/use-ma-price";
import { Copy, WalletCards, ChevronRight, Bell, Settings, History, GitBranch, Server, Share2, ArrowLeftRight, User, Flame, Download, TrendingUp, X, CheckCircle, ExternalLink, Vault } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getNodeOverview } from "@/lib/api";
import type { NodeOverview } from "@shared/types";
import type { Profile } from "@shared/types";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const MENU_ITEMS = [
  { labelKey: "profile.myNodesLabel", icon: Server, path: "/profile/nodes", descKey: "profile.nodeManagementDesc" },
  { labelKey: "profile.swap", icon: ArrowLeftRight, path: "/profile/swap", descKey: "profile.swapDesc" },
  { labelKey: "profile.transactionHistory", icon: History, path: "/profile/transactions", descKey: "profile.transactionHistoryDesc" },
  { labelKey: "profile.notifications", icon: Bell, path: "/profile/notifications", descKey: "profile.notificationsDesc" },
  { labelKey: "profile.settings", icon: Settings, path: "/profile/settings", descKey: "profile.settingsDesc" },
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const { formatCompactMA, price } = useMaPrice();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["profile", walletAddr],
    queryFn: () => getProfile(walletAddr),
    enabled: isConnected,
  });

  const { data: nodeOverview } = useQuery<NodeOverview>({
    queryKey: ["node-overview", walletAddr],
    queryFn: () => getNodeOverview(walletAddr),
    enabled: isConnected,
  });

  // RUNE lock stats
  const { data: runeLockStats } = useQuery<{ totalRuneLocked: string; totalVeRune: string; positions: number }>({
    queryKey: ["rune-lock-stats", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/rune-lock/stats?wallet=${encodeURIComponent(walletAddr)}`);
      return r.json();
    },
    enabled: isConnected,
  });

  // EMBER burn stats
  const { data: emberStats } = useQuery<{ totalRuneBurned: string; dailyEmber: string; totalClaimedEmber: string }>({
    queryKey: ["ember-burn-stats", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/ember-burn/stats?wallet=${encodeURIComponent(walletAddr)}`);
      return r.json();
    },
    enabled: isConnected,
  });

  // Supabase on-chain node data
  const { data: sbTeam } = useQuery<{ ownNode: { nodeId: number; nodeTier: string; usdtAmount: number } | null; referrer: string | null }>({
    queryKey: ["supabase-team-own", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/supabase/team/${walletAddr}`);
      return r.json();
    },
    enabled: isConnected,
  });

  // Vault yield query (withdrawable QA balance from vault rewards)
  const { data: vaultYieldData = { yieldUsd: 0 } } = useQuery({
    queryKey: ["vault-yield", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/vault-yield?wallet=${encodeURIComponent(walletAddr)}`);
      return r.json();
    },
    enabled: isConnected,
    refetchInterval: 60_000,
  });
  const vaultYieldUsd = Number(vaultYieldData.yieldUsd || 0);
  // Convert USD yield to QA (MA) quantity using price
  const vaultYieldMA = price > 0 ? vaultYieldUsd / price : vaultYieldUsd;

  // Withdraw dialog state
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPlan, setWithdrawPlan] = useState<"A" | "B" | "C" | "D" | "E">("A");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);

  const WITHDRAW_PLANS = [
    { key: "A", days: 60, burn: 0, label: "60天线性" },
    { key: "B", days: 30, burn: 5, label: "30天线性" },
    { key: "C", days: 15, burn: 10, label: "15天线性" },
    { key: "D", days: 7, burn: 15, label: "7天线性" },
    { key: "E", days: 0, burn: 20, label: "即时释放" },
  ] as const;

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0 || withdrawBusy) return;
    setWithdrawBusy(true);
    try {
      // Simulate network delay then show success (contract call to be wired)
      await new Promise(r => setTimeout(r, 1800));
      const plan = WITHDRAW_PLANS.find(p => p.key === withdrawPlan)!;
      const received = amt * (1 - plan.burn / 100);
      setWithdrawDone(true);
      toast({
        title: "提现申请已提交",
        description: `${received.toFixed(2)} QA → ${plan.days > 0 ? `${plan.days}天线性释放至钱包` : "即时释放至钱包"}`,
      });
    } catch {
      toast({ title: "提现失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const referralEarnings = Number(profile?.referralEarnings || 0);
  const nodeEarnings = Number(nodeOverview?.rewards?.totalEarnings || 0);
  const totalEarnings = vaultYieldMA + referralEarnings;

  const runeLocked = Number(runeLockStats?.totalRuneLocked || 0);
  const veRune = Number(runeLockStats?.totalVeRune || 0);
  const emberBurned = Number(emberStats?.totalRuneBurned || 0);
  const dailyEmber = Number(emberStats?.dailyEmber || 0);

  // On-chain node info from Supabase
  const ownNode = sbTeam?.ownNode || null;
  const TIER_CN: Record<string, string> = {
    BASIC: "初级节点", STANDARD: "中级节点", ADVANCED: "高级节点",
    SUPER: "超级节点", FOUNDER: "联创节点", GENESIS: "创世节点",
  };
  const TIER_COLOR: Record<string, string> = {
    BASIC: "#94a3b8", STANDARD: "#60a5fa", ADVANCED: "#34d399",
    SUPER: "#f59e0b", FOUNDER: "#a855f7", GENESIS: "#e879f9",
  };
  const rawTier = (ownNode?.nodeTier || "").toUpperCase();
  const nodeTierLabel = rawTier && TIER_CN[rawTier] ? TIER_CN[rawTier] : null;
  const nodeTierColor = rawTier && TIER_COLOR[rawTier] ? TIER_COLOR[rawTier] : "#94a3b8";

  const referralLink = useMemo(() => {
    if (!walletAddr || typeof window === "undefined") return "";
    return `${window.location.origin}/r/${walletAddr}`;
  }, [walletAddr]);

  const copyToClipboard = async (text: string) => {
    await copyText(text);
    toast({ title: t("common.copied"), description: t("common.copiedDesc") });
  };

  const shareReferralLink = () => {
    if (!referralLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "QA PROTOCOL", text: t("profile.inviteFriendsDesc"), url: referralLink }).catch(() => {});
    } else {
      copyToClipboard(referralLink);
    }
  };

  const shortAddr = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "";

  return (
    <div className="pb-24 lg:pb-8 lg:pt-4" data-testid="page-profile" style={{ background: "#060606" }}>

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #1a1408 0%, #0e0c08 50%, #060606 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,50,0.1) 0%, transparent 65%)" }} />
        <div className="relative px-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(43,74%,50%), hsl(38,70%,38%))", boxShadow: "0 0 24px rgba(212,168,50,0.2)" }}
            >
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {!isConnected ? (
                <div className="text-[15px] font-bold text-white/40" data-testid="text-wallet-address">{t("common.notConnected")}</div>
              ) : profileLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-white" data-testid="text-wallet-address">{shortAddr}</span>
                    <button onClick={() => copyToClipboard(walletAddr)} className="p-1 rounded-md transition-colors hover:bg-white/10" data-testid="button-copy-address">
                      <Copy className="h-3.5 w-3.5 text-white/50" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-white/55 truncate">{walletAddr}</div>
                </>
              )}

              {/* Rank + Node inline below address */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {/* 等级 */}
                <div className="surface-inset flex items-center gap-1.5 rounded-lg border border-black/30 bg-black/25 px-2.5 py-1" data-testid="card-rank">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-white/45">等级</span>
                  {!isConnected || profileLoading ? (
                    <span className="text-[12px] font-black text-white/25">--</span>
                  ) : (
                    <span className="text-[13px] font-black" style={{ color: "hsl(43,74%,65%)" }} data-testid="text-rank">
                      {profile?.rank || "V0"}
                    </span>
                  )}
                </div>

                {/* 持有节点 */}
                <div className="surface-inset flex items-center gap-1.5 rounded-lg border border-black/30 bg-black/25 px-2.5 py-1" data-testid="card-node-tier">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-white/45">节点</span>
                  {!isConnected || profileLoading ? (
                    <span className="text-[12px] font-bold text-white/25">--</span>
                  ) : nodeTierLabel ? (
                    <span className="text-[12px] font-bold" style={{ color: nodeTierColor }} data-testid="text-node-tier">
                      {nodeTierLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-white/35" data-testid="text-node-tier">未持有</span>
                  )}
                </div>

                {profile?.isVip && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#fbbf24" }} data-testid="badge-vip">VIP</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-1 space-y-3">

        {/* ── Main asset overview card ── */}
        <div className="surface-3d rounded-2xl overflow-hidden border border-amber-500/55 bg-gradient-to-br from-slate-700/90 via-slate-700/80 to-slate-800/85">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/45 to-transparent pointer-events-none" />

          {/* 累计收益 — sunken data well */}
          <div className="surface-inset mx-4 mt-4 mb-4 rounded-2xl border border-black/30 bg-black/25 px-5 pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400/70" />
                  <span className="text-[11px] text-white/70 font-medium uppercase tracking-wider">累计收益</span>
                </div>
                {!isConnected ? (
                  <div className="text-[30px] font-black text-white/20">--</div>
                ) : profileLoading ? (
                  <Skeleton className="h-9 w-28" />
                ) : (
                  <div className="text-[30px] font-black" style={{ color: "hsl(43,74%,60%)" }} data-testid="text-total-earnings">
                    {formatCompactMA(totalEarnings)}
                  </div>
                )}
              </div>
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,168,50,0.08)", border: "1px solid rgba(212,168,50,0.15)" }}>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
            {isConnected && (
              <div className="flex gap-2 mt-3">
                {[
                  { label: "节点收益", value: formatCompactMA(nodeEarnings) },
                  { label: "推广佣金", value: formatCompactMA(referralEarnings) },
                ].map((item, i) => (
                  <div key={i} className="surface-inset flex-1 rounded-xl px-2.5 py-2 text-center border border-black/25 bg-black/20">
                    <div className="text-[9px] text-white/60 mb-0.5">{item.label}</div>
                    <div className="text-[12px] font-bold text-white/90">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 锁仓RUNE + 锁仓EMBER — sunken data cells */}
          <div className="grid grid-cols-2 border-t border-amber-500/20">
            {/* 锁仓RUNE */}
            <div className="surface-inset bg-black/20 px-4 py-4 border-r border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="h-3.5 w-3.5" style={{ color: "rgba(59,130,246,0.6)" }} />
                <span className="text-[10px] text-white/65 font-medium">锁仓 QA</span>
              </div>
              {!isConnected ? (
                <div className="text-[20px] font-black text-white/20">--</div>
              ) : (
                <>
                  <div className="text-[20px] font-black text-white" data-testid="text-rune-locked">
                    {runeLocked > 0 ? formatCompactMA(runeLocked) : "0"}
                  </div>
                  {veRune > 0 && (
                    <div className="text-[10px] text-white/60 mt-0.5">veQA: {formatCompactMA(veRune)}</div>
                  )}
                  {runeLocked === 0 && (
                    <div className="text-[10px] text-white/50 mt-0.5">暂未锁仓</div>
                  )}
                </>
              )}
            </div>

            {/* 锁仓EMBER */}
            <div className="surface-inset bg-black/20 px-4 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-orange-400/60" />
                <span className="text-[10px] text-white/65 font-medium">锁仓 QI</span>
              </div>
              {!isConnected ? (
                <div className="text-[20px] font-black text-white/20">--</div>
              ) : (
                <>
                  <div className="text-[20px] font-black text-white" data-testid="text-ember-locked">
                    {emberBurned > 0 ? formatCompactMA(emberBurned) : "0"}
                  </div>
                  {dailyEmber > 0 && (
                    <div className="text-[10px] text-white/60 mt-0.5">日产: +{formatCompactMA(dailyEmber)} /天</div>
                  )}
                  {emberBurned === 0 && (
                    <div className="text-[10px] text-white/50 mt-0.5">暂未销毁</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Not connected placeholder */}
          {!isConnected && (
            <div className="px-5 pb-5 pt-1 text-center">
              <WalletCards className="h-6 w-6 text-white/20 mx-auto mb-2" />
              <p className="text-[12px] text-white/60" data-testid="text-connect-prompt">{t("common.connectWalletPrompt")}</p>
            </div>
          )}
        </div>

        {/* ── Invite link card ── */}
        {isConnected && referralLink && (
          <div className="surface-3d rounded-2xl p-4 space-y-3 border border-amber-500/55 bg-gradient-to-br from-slate-700/90 via-slate-700/80 to-slate-800/85">
            {/* Invite link */}
            <div>
              <div className="text-[12px] font-bold text-white/70 mb-2">{t("profile.inviteFriends", "邀请链接")}</div>
              <div className="flex items-center gap-2">
                <div className="surface-inset flex-1 min-w-0 rounded-xl px-3 py-2.5 font-mono text-[11px] text-white/65 truncate border border-black/25 bg-black/20">
                  {referralLink}
                </div>
                <button onClick={() => copyToClipboard(referralLink)} className="shrink-0 px-3 py-2.5 rounded-xl transition-all active:scale-95 border border-amber-500/30 bg-white/[0.06] hover:border-amber-500/55" data-testid="button-copy-referral">
                  <Copy className="h-4 w-4 text-white/50" />
                </button>
                <button onClick={shareReferralLink} className="shrink-0 px-3.5 py-2.5 rounded-xl font-medium transition-all hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(135deg, hsl(43,74%,50%), hsl(38,70%,40%))", boxShadow: "0 2px 8px rgba(212,168,50,0.2)" }} data-testid="button-share-referral">
                  <Share2 className="h-4 w-4 text-black" />
                </button>
              </div>
            </div>

            {/* My referral code = own wallet address */}
            <div>
              <div className="text-[11px] text-white/65 mb-1">我的推荐码（钱包地址）</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 font-mono text-[11px] text-white/70 truncate">{walletAddr}</div>
                <button onClick={() => copyToClipboard(walletAddr)} className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10" data-testid="button-copy-own-address">
                  <Copy className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-500/25">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border border-amber-500/30 bg-white/[0.05] hover:border-amber-500/55 hover:bg-amber-500/[0.07]"
                onClick={() => navigate("/profile/referral")}
                data-testid="menu-referral"
              >
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(212,168,50,0.08)", border: "1px solid rgba(212,168,50,0.15)" }}>
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-white/90">{t("profile.referralTeam")}</div>
                  <div className="text-[10px] text-white/60">{t("profile.referralTeamDesc")}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/55 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ── Menu items (mobile only) ── */}
        <div className="lg:hidden">
          <div className="surface-3d rounded-2xl overflow-hidden border border-amber-500/55 bg-gradient-to-br from-slate-700/90 via-slate-700/80 to-slate-800/85">
            {MENU_ITEMS.map((item, idx) => (
              <button
                key={item.path}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-amber-500/[0.05]"
                style={{ borderBottom: idx < MENU_ITEMS.length - 1 ? "1px solid rgba(251,191,36,0.1)" : "none" }}
                onClick={() => navigate(item.path)}
                data-testid={`menu-${item.path.split("/").pop()}`}
              >
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/35 bg-white/[0.06]">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white/85">{t(item.labelKey)}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">{t(item.descKey)}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/50 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
