import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import { useMaPrice } from "@/hooks/use-ma-price";
import { Copy, WalletCards, ChevronRight, Bell, Settings, History, GitBranch, Server, Share2, ArrowLeftRight, User, Coins, Vault, Flame, Lock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getNodeOverview, getVaultPositions } from "@/lib/api";
import type { NodeOverview } from "@shared/types";
import type { Profile } from "@shared/types";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const MENU_ITEMS = [
  { labelKey: "profile.myNodesLabel", icon: Server, path: "/profile/nodes", descKey: "profile.nodeManagementDesc" },
  { labelKey: "profile.myVaultPositions", icon: Vault, path: "/profile/vault", descKey: "profile.myVaultPositionsDesc" },
  { labelKey: "profile.runeToken", icon: Coins, path: "/profile/ma", descKey: "profile.runeTokenDesc" },
  { labelKey: "profile.swap", icon: ArrowLeftRight, path: "/profile/swap", descKey: "profile.swapDesc" },
  { labelKey: "profile.transactionHistory", icon: History, path: "/profile/transactions", descKey: "profile.transactionHistoryDesc" },
  { labelKey: "profile.notifications", icon: Bell, path: "/profile/notifications", descKey: "profile.notificationsDesc" },
  { labelKey: "profile.settings", icon: Settings, path: "/profile/settings", descKey: "profile.settingsDesc" },
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const { formatCompactMA } = useMaPrice();
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

  const { data: vaultPositions } = useQuery({
    queryKey: ["vault-positions", walletAddr],
    queryFn: () => getVaultPositions(walletAddr),
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

  const vaultYield = useMemo(() => {
    if (!vaultPositions) return 0;
    const now = new Date();
    let yieldSum = 0;
    for (const p of vaultPositions) {
      if (p.status !== "ACTIVE") continue;
      if (p.bonusYieldLocked) continue;
      const amt = Number(p.principal || 0);
      const start = new Date(p.startDate!);
      const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      yieldSum += amt * Number(p.dailyRate || 0) * days;
    }
    return yieldSum;
  }, [vaultPositions]);

  const referralEarnings = Number(profile?.referralEarnings || 0);
  const nodeEarnings = Number(nodeOverview?.rewards?.totalEarnings || 0);
  const totalEarnings = nodeEarnings + vaultYield + referralEarnings;

  const runeLocked = Number(runeLockStats?.totalRuneLocked || 0);
  const veRune = Number(runeLockStats?.totalVeRune || 0);
  const emberBurned = Number(emberStats?.totalRuneBurned || 0);
  const dailyEmber = Number(emberStats?.dailyEmber || 0);

  // On-chain node info from Supabase
  const ownNode = sbTeam?.ownNode || null;
  const isSuper = ownNode?.nodeId === 401;
  const isStd = ownNode?.nodeId === 501;
  const nodeTierLabel = isSuper ? "超级节点" : isStd ? "标准节点" : null;
  const nodeTierColor = isSuper ? "#f59e0b" : "#60a5fa";
  const nodeTierBg = isSuper ? "rgba(245,158,11,0.12)" : "rgba(96,165,250,0.1)";
  const nodeTierBorder = isSuper ? "rgba(245,158,11,0.3)" : "rgba(96,165,250,0.25)";

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
      navigator.share({ title: "RUNE PROTOCOL", text: t("profile.inviteFriendsDesc"), url: referralLink }).catch(() => {});
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
          <div className="flex items-center gap-3 mb-4">
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
                  <div className="font-mono text-[10px] text-white/30 mt-0.5 truncate">{walletAddr}</div>
                </>
              )}
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {isConnected && profile ? (
              <>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(212,168,50,0.12)", border: "1px solid rgba(212,168,50,0.25)", color: "hsl(43,74%,62%)" }} data-testid="badge-rank">
                  {profile.rank || "V0"}
                </span>
                {nodeTierLabel && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: nodeTierBg, border: `1px solid ${nodeTierBorder}`, color: nodeTierColor }} data-testid="badge-node-type">
                    {nodeTierLabel}
                  </span>
                )}
                {profile.isVip && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#fbbf24" }} data-testid="badge-vip">VIP</span>
                )}
              </>
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white/30" style={{ background: "rgba(255,255,255,0.05)" }}>-- --</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-1 space-y-3">

        {/* ── Main asset overview card ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* 累计收益 — top highlight */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-white/35" />
                  <span className="text-[11px] text-white/40 font-medium uppercase tracking-wider">累计收益</span>
                </div>
                {!isConnected ? (
                  <div className="text-[30px] font-black text-white/15">--</div>
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
                  { label: "锁仓收益", value: formatCompactMA(vaultYield) },
                  { label: "推广佣金", value: formatCompactMA(referralEarnings) },
                ].map((item, i) => (
                  <div key={i} className="flex-1 rounded-xl px-2.5 py-2 text-center" style={{ background: "#1a1a1a" }}>
                    <div className="text-[9px] text-white/30 mb-0.5">{item.label}</div>
                    <div className="text-[12px] font-bold text-white/70">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 锁仓RUNE + 锁仓EMBER */}
          <div className="grid grid-cols-2">
            {/* 锁仓RUNE */}
            <div className="px-4 py-4" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="h-3.5 w-3.5" style={{ color: "rgba(212,168,50,0.6)" }} />
                <span className="text-[10px] text-white/35 font-medium">锁仓 RUNE</span>
              </div>
              {!isConnected ? (
                <div className="text-[20px] font-black text-white/15">--</div>
              ) : (
                <>
                  <div className="text-[20px] font-black text-white" data-testid="text-rune-locked">
                    {runeLocked > 0 ? formatCompactMA(runeLocked) : "0"}
                  </div>
                  {veRune > 0 && (
                    <div className="text-[10px] text-white/30 mt-0.5">
                      veRUNE: {formatCompactMA(veRune)}
                    </div>
                  )}
                  {runeLocked === 0 && (
                    <div className="text-[10px] text-white/25 mt-0.5">暂未锁仓</div>
                  )}
                </>
              )}
            </div>

            {/* 锁仓EMBER */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-orange-400/60" />
                <span className="text-[10px] text-white/35 font-medium">锁仓 EMBER</span>
              </div>
              {!isConnected ? (
                <div className="text-[20px] font-black text-white/15">--</div>
              ) : (
                <>
                  <div className="text-[20px] font-black text-white" data-testid="text-ember-locked">
                    {emberBurned > 0 ? formatCompactMA(emberBurned) : "0"}
                  </div>
                  {dailyEmber > 0 && (
                    <div className="text-[10px] text-white/30 mt-0.5">
                      日产: +{formatCompactMA(dailyEmber)} /天
                    </div>
                  )}
                  {emberBurned === 0 && (
                    <div className="text-[10px] text-white/25 mt-0.5">暂未销毁</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Not connected placeholder */}
          {!isConnected && (
            <div className="px-5 pb-5 pt-1 text-center">
              <WalletCards className="h-6 w-6 text-white/20 mx-auto mb-2" />
              <p className="text-[12px] text-white/30" data-testid="text-connect-prompt">{t("common.connectWalletPrompt")}</p>
            </div>
          )}
        </div>

        {/* ── Invite link card ── */}
        {isConnected && referralLink && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Invite link */}
            <div>
              <div className="text-[12px] font-bold text-white/70 mb-2">{t("profile.inviteFriends", "邀请链接")}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-xl px-3 py-2.5 font-mono text-[11px] text-white/45 truncate" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {referralLink}
                </div>
                <button onClick={() => copyToClipboard(referralLink)} className="shrink-0 px-3 py-2.5 rounded-xl transition-all active:scale-95" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }} data-testid="button-copy-referral">
                  <Copy className="h-4 w-4 text-white/50" />
                </button>
                <button onClick={shareReferralLink} className="shrink-0 px-3.5 py-2.5 rounded-xl font-medium transition-all hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(135deg, hsl(43,74%,50%), hsl(38,70%,40%))", boxShadow: "0 2px 8px rgba(212,168,50,0.2)" }} data-testid="button-share-referral">
                  <Share2 className="h-4 w-4 text-black" />
                </button>
              </div>
            </div>

            {/* My referral code = own wallet address */}
            <div>
              <div className="text-[11px] text-white/35 mb-1">我的推荐码（钱包地址）</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 font-mono text-[11px] text-white/50 truncate">{walletAddr}</div>
                <button onClick={() => copyToClipboard(walletAddr)} className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10" data-testid="button-copy-own-address">
                  <Copy className="h-3.5 w-3.5 text-white/35" />
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="pt-2">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.04] active:bg-white/[0.06]"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}
                onClick={() => navigate("/profile/referral")}
                data-testid="menu-referral"
              >
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(212,168,50,0.08)", border: "1px solid rgba(212,168,50,0.15)" }}>
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-white/90">{t("profile.referralTeam")}</div>
                  <div className="text-[10px] text-white/35">{t("profile.referralTeamDesc")}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ── Menu items (mobile only) ── */}
        <div className="lg:hidden">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
            {MENU_ITEMS.map((item, idx) => (
              <button
                key={item.path}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-white/[0.04] active:bg-white/[0.06]"
                style={{ borderBottom: idx < MENU_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                onClick={() => navigate(item.path)}
                data-testid={`menu-${item.path.split("/").pop()}`}
              >
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white/85">{t(item.labelKey)}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{t(item.descKey)}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
