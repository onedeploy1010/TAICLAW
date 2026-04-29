import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import { useMaPrice } from "@/hooks/use-ma-price";
import { Copy, WalletCards, Wallet, ArrowUpFromLine, ChevronRight, Bell, Settings, History, GitBranch, Server, TrendingUp, Share2, Link2, ArrowLeftRight, User, Coins, Vault } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getNodeOverview, getVaultPositions } from "@/lib/api";
import type { NodeOverview } from "@shared/types";
import { MAReleaseDialog } from "@/components/vault/ma-release-dialog";
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
  const { formatMA, formatCompactMA } = useMaPrice();
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

  const vaultYield = useMemo(() => {
    if (!vaultPositions) return 0;
    const now = new Date();
    let yieldSum = 0;
    for (const p of vaultPositions) {
      if (p.status !== "ACTIVE") continue;
      // Skip bonus positions with locked yield — they don't count as available earnings
      if (p.bonusYieldLocked) continue;
      const amt = Number(p.principal || 0);
      const start = new Date(p.startDate!);
      const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      yieldSum += amt * Number(p.dailyRate || 0) * days;
    }
    return yieldSum;
  }, [vaultPositions]);

  const [releaseOpen, setReleaseOpen] = useState(false);

  const deposited = Number(profile?.totalDeposited || 0);
  const withdrawn = Number(profile?.totalWithdrawn || 0);
  const referralEarnings = Number(profile?.referralEarnings || 0);
  const nodeEarnings = Number(nodeOverview?.rewards?.totalEarnings || 0);
  const totalEarnings = nodeEarnings + vaultYield + referralEarnings;
  const net = deposited - withdrawn + referralEarnings;

  // Query claimed yield to calculate available balance
  const { data: claimedYield = 0 } = useQuery({
    queryKey: ["claimed-yield", walletAddr],
    queryFn: async () => {
      if (!walletAddr) return 0;
      const txs = await fetch(`/api/transactions/${encodeURIComponent(walletAddr)}?type=YIELD_CLAIM`).then(r => r.json()).catch(() => []);
      return (txs || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    },
    enabled: !!walletAddr,
  });
  const availableEarnings = Math.max(0, totalEarnings - claimedYield);

  const refCode = profile?.refCode;
  // Self-referral link: both sponsor and placement = self
  const referralLink = useMemo(() => {
    if (!refCode || typeof window === "undefined") return "";
    return `${window.location.origin}/r/${refCode}/${refCode}`;
  }, [refCode]);

  const copyToClipboard = async (text: string) => {
    await copyText(text);
    toast({ title: t("common.copied"), description: t("common.copiedDesc") });
  };

  const shareReferralLink = () => {
    if (!referralLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: "RUNE PROTOCOL",
        text: t("profile.inviteFriendsDesc"),
        url: referralLink,
      }).catch(() => {});
    } else {
      copyToClipboard(referralLink);
    }
  };

  const shortAddr = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "";

  return (
    <div className="pb-24 lg:pb-8 lg:pt-4" data-testid="page-profile" style={{ background: "#060606" }}>

      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #1a1408 0%, #060606 100%)" }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,50,0.15) 0%, transparent 70%)" }} />
        <div className="relative px-4 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(43,74%,58%), hsl(38,70%,46%))", boxShadow: "0 0 20px rgba(212,168,50,0.25)" }}
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
                    <button
                      onClick={() => copyToClipboard(walletAddr)}
                      className="p-1 rounded-md transition-colors hover:bg-white/10"
                      data-testid="button-copy-address"
                    >
                      <Copy className="h-3.5 w-3.5 text-white/50" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-white/35 mt-0.5 truncate">{walletAddr}</div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isConnected && profile ? (
              <>
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-semibold text-white/90"
                  style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
                  data-testid="badge-rank"
                >
                  {t("common.rank")}: {profile.rank}
                </span>
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-semibold text-white/90"
                  style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
                  data-testid="badge-node-type"
                >
                  {t("common.node")}: {profile.nodeType}
                </span>
                {profile.isVip && (
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-bold text-yellow-300"
                    style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)" }}
                    data-testid="badge-vip"
                  >
                    VIP
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white/40" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {t("common.rank")}: --
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white/40" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {t("common.node")}: --
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-1 space-y-3">

        <div
          className="rounded-2xl relative overflow-hidden"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.35)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.05]" style={{ background: "radial-gradient(circle, #d4a832, transparent 70%)" }} />

          <div className="p-4 relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-white/45 font-medium uppercase tracking-wider mb-1">{t("profile.totalAssets")}</div>
                {!isConnected ? (
                  <div className="text-[28px] font-black text-white/20 leading-tight" data-testid="text-net-assets">--</div>
                ) : profileLoading ? (
                  <Skeleton className="h-9 w-28" />
                ) : (
                  <div className="text-[28px] font-black text-white leading-tight" data-testid="text-net-assets">{formatMA(net)}</div>
                )}
              </div>
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.2), rgba(212,168,50,0.05))", border: "1px solid rgba(212,168,50,0.15)" }}
              >
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>

          {isConnected && (
            <>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "0 16px" }} />
              <div className="p-4 relative">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.2), rgba(212,168,50,0.05))", border: "1px solid rgba(212,168,50,0.15)" }}
                    >
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-[11px] text-white/45 font-medium">{t("profile.availableEarnings", "可提收益")}</div>
                      {profileLoading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : (
                        <div className="text-[18px] font-bold text-white" data-testid="text-total-earnings">
                          {formatMA(availableEarnings)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl text-[12px] h-8"
                    onClick={() => setReleaseOpen(true)}
                    disabled={availableEarnings <= 0}
                    data-testid="button-withdraw-earnings"
                  >
                    <ArrowUpFromLine className="mr-1 h-3 w-3" /> {t("common.withdraw")}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: t("profile.nodeEarningsLabel"), value: formatCompactMA(nodeEarnings) },
                    { label: t("profile.vaultEarningsLabel"), value: formatCompactMA(vaultYield) },
                    { label: t("profile.brokerEarningsLabel"), value: formatCompactMA(referralEarnings) },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-2.5" style={{ background: "#1c1c1c" }}>
                      <div className="text-[10px] text-white/40 mb-0.5">{item.label}</div>
                      <div className="text-[13px] font-bold text-white/90">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isConnected && (
            <>
              <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "0 16px" }} />
              <div className="p-6 text-center">
                <WalletCards className="h-7 w-7 text-white/20 mx-auto mb-2" />
                <p className="text-[12px] text-white/35" data-testid="text-connect-prompt">
                  {t("common.connectWalletPrompt")}
                </p>
              </div>
            </>
          )}
        </div>

        {isConnected && referralLink && (
          <div
            className="rounded-2xl p-4"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.35)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.2), rgba(212,168,50,0.05))", border: "1px solid rgba(212,168,50,0.15)" }}
              >
                <Link2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[14px] font-bold text-white">{t("profile.inviteFriends")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 font-mono text-[11px] text-white/55 truncate"
                style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {referralLink}
              </div>
              <button
                onClick={() => copyToClipboard(referralLink)}
                className="shrink-0 px-3 py-2.5 rounded-xl text-white/80 transition-all hover:bg-white/10 active:scale-95"
                style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={shareReferralLink}
                className="shrink-0 px-3.5 py-2.5 rounded-xl text-black font-medium transition-all hover:brightness-110 active:scale-95"
                style={{ background: "linear-gradient(135deg, hsl(43,74%,58%), hsl(38,70%,46%))", boxShadow: "0 2px 8px rgba(212,168,50,0.25)" }}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 text-[10px] text-white/35">{t("profile.inviteFriendsDesc")}</div>

            <button
              className="w-full mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.04] active:bg-white/[0.06]"
              style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={() => navigate("/profile/referral")}
              data-testid="menu-referral"
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(212,168,50,0.2), rgba(212,168,50,0.05))", border: "1px solid rgba(212,168,50,0.15)" }}
              >
                <GitBranch className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-white/90">{t("profile.referralTeam")}</div>
                <div className="text-[10px] text-white/35">{t("profile.referralTeamDesc")}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
            </button>
          </div>
        )}

        {/* Menu items — hidden on desktop (sidebar handles navigation) */}
        <div className="lg:hidden">
          <div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.35)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
            >
              {MENU_ITEMS.map((item, idx) => (
                <button
                  key={item.path}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-white/[0.04] active:bg-white/[0.06]"
                  style={{ borderBottom: idx < MENU_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                  onClick={() => navigate(item.path)}
                  data-testid={`menu-${item.path.split("/").pop()}`}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white/90">{t(item.labelKey)}</div>
                    <div className="text-[10px] text-white/35 mt-0.5">{t(item.descKey)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <MAReleaseDialog open={releaseOpen} onOpenChange={setReleaseOpen} />
    </div>
  );
}
