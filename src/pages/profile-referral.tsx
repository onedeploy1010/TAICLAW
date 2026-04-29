import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress, formatCompact } from "@/lib/constants";
import { useMaPrice } from "@/hooks/use-ma-price";
import { ArrowLeft, Copy, Users, UserPlus, DollarSign, WalletCards, Layers, ChevronRight, ChevronDown, History, Network, Link2, Info, ServerIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getProfile, getCommissionRecords } from "@/lib/api";
import type { Profile, CommissionSummary } from "@shared/types";
import { useTranslation } from "react-i18next";

interface ReferralMember {
  id: string;
  walletAddress: string;
  rank: string;
  nodeType: string;
  totalDeposited: string;
  level: number;
  refCode?: string;
  sponsorWallet?: string;
  sponsorCode?: string;
  subCount?: number;
  subReferrals?: ReferralMember[] | null;
}

interface ReferralData {
  referrals: ReferralMember[];
  teamSize: number;
  directCount: number;
}

type MainTab = "team" | "history";
type HistoryFilter = "all" | "direct" | "diff" | "same_rank" | "override" | "node_reward";

export default function ProfileReferralPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const { formatCompactMA, usdcToMA } = useMaPrice();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;

  const [mainTab, setMainTab] = useState<MainTab>("team");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  const [addrStack, setAddrStack] = useState<Array<{ addr: string; label: string }>>([]);
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const [skipCount, setSkipCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<string>("all");
  const viewingAddr = addrStack.length > 0 ? addrStack[addrStack.length - 1].addr : walletAddr;
  const isViewingSelf = viewingAddr === walletAddr;

  const drillInto = useCallback((addr: string, label: string) => {
    setAddrStack((prev) => [...prev, { addr, label }]);
  }, []);

  const goBack = useCallback(() => {
    setAddrStack((prev) => prev.slice(0, -1));
  }, []);

  const goToRoot = useCallback(() => {
    setAddrStack([]);
  }, []);

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile", walletAddr],
    queryFn: () => getProfile(walletAddr),
    enabled: isConnected,
  });

  // ── Supabase on-chain data ───────────────────────────────────────────────
  const { data: globalStats } = useQuery<{
    totalMembers: number; activeMembers: number; totalNodes: number; superNodes: number; stdNodes: number;
  }>({
    queryKey: ["supabase-global-stats"],
    queryFn: async () => { const r = await fetch("/api/supabase/global-stats"); return r.json(); },
  });

  const { data: sbTeam, isLoading } = useQuery<{
    referrals: ReferralMember[]; teamSize: number; directCount: number;
    ownUsdt: number; directUsdt: number; teamUsdt: number;
    ownNode: { nodeId: number; nodeTier: string; usdtAmount: number } | null;
    referrer: string | null;
  }>({
    queryKey: ["supabase-team", viewingAddr],
    queryFn: async () => { const r = await fetch(`/api/supabase/team/${viewingAddr}`); return r.json(); },
    enabled: isConnected,
  });

  // Commission history from Neon DB
  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ["commission", walletAddr],
    queryFn: () => getCommissionRecords(walletAddr) as Promise<CommissionSummary>,
    enabled: isConnected,
  });

  // Node rewards (FIXED_YIELD + POOL_DIVIDEND)
  const { data: nodeRewards, isLoading: nodeRewardsLoading } = useQuery<any[]>({
    queryKey: ["node-rewards", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/node-rewards/${encodeURIComponent(walletAddr)}`);
      const d = await r.json();
      return d?.rewards ?? [];
    },
    enabled: isConnected,
  });

  const totalCommission = Number(commission?.totalCommission || 0);
  const directTotal = Number(commission?.directReferralTotal || 0);
  const diffTotal = Number(commission?.differentialTotal || 0);
  const sameRankTotal = Number(commission?.sameRankTotal || 0);
  const overrideTotal = Number(commission?.overrideTotal || 0);

  const refCode = profile?.refCode;
  const currentRank = profile?.rank || "V0";
  const referralLink = walletAddr ? `${window.location.origin}/r/${walletAddr}` : "--";

  // Use Supabase data for team stats
  const teamData = sbTeam;
  const ownNode   = sbTeam?.ownNode || null;
  const rawReferrer = sbTeam?.referrer || (profile as any)?.parentWallet || null;
  // Exclude self-referral in case on-chain data has it
  const referrer = rawReferrer && rawReferrer.toLowerCase() !== walletAddr.toLowerCase() ? rawReferrer : null;
  const directCount = sbTeam?.directCount ?? 0;
  const teamSize    = sbTeam?.teamSize ?? 0;
  const ownUsdt   = sbTeam?.ownUsdt ?? 0;
  const directUsdt = sbTeam?.directUsdt ?? 0;
  const teamUsdt  = sbTeam?.teamUsdt ?? 0;

  // Node tier derived values
  const isSuper = ownNode?.nodeId === 401;
  const isStd   = ownNode?.nodeId === 501;
  const nodeTierLabel = isSuper ? "超级节点" : isStd ? "标准节点" : "注册会员";
  const nodeTierColor = isSuper ? "#f59e0b" : isStd ? "#60a5fa" : "rgba(255,255,255,0.35)";
  const nodeTierBg    = isSuper ? "rgba(245,158,11,0.12)" : isStd ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)";
  const nodeTierBorder= isSuper ? "rgba(245,158,11,0.4)"  : isStd ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.1)";

  const copyToClipboard = async (text: string) => {
    await copyText(text);
    toast({ title: t("common.copied"), description: t("common.copiedDesc") });
  };

  const filteredRecords = commission?.records?.filter((r: any) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "direct") return r.details?.type === "direct_referral";
    if (historyFilter === "diff") return r.details?.type === "differential";
    if (historyFilter === "same_rank") return r.details?.type === "same_rank";
    if (historyFilter === "override") return r.details?.type === "override";
    return true;
  }) || [];

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pt-4" style={{ background: "#0a0a0a" }} data-testid="page-profile-referral">
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #1a1408 0%, #28200f 30%, #15120a 60%, #0a0a0a 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 20%, rgba(212,168,50,0.12) 0%, transparent 55%)" }} />
        <div className="absolute top-0 right-0 w-48 h-48 opacity-15" style={{ background: "radial-gradient(circle, rgba(212,168,50,0.5), transparent 70%)", filter: "blur(30px)" }} />

        <div className="relative px-4 pt-3 pb-5">
          <div className="flex items-center justify-center relative mb-5 lg:justify-start">
            <button
              onClick={() => navigate("/profile")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors lg:hidden"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ArrowLeft className="h-5 w-5 text-white/90" />
            </button>
            <h1 className="text-[17px] font-bold tracking-wide text-white">{t("profile.promotionCenter")}</h1>
          </div>

          {/* ── Global Stats Strip ── */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {[
              { label: "全球会员", value: globalStats ? `${globalStats.totalMembers}` : "--" },
              { label: "激活会员", value: globalStats ? `${globalStats.activeMembers}` : "--" },
              { label: "总节点数", value: globalStats ? `${globalStats.totalNodes}` : "--" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-[9px] text-white/30 mb-1">{s.label}</div>
                <div className="text-[16px] font-black text-white">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-1 space-y-3">
        <div className="rounded-2xl p-4 space-y-4" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Invite link = base URL + my wallet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold text-white">{t("profile.inviteLink", "邀请链接")}</span>
              <button
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all active:scale-95"
                style={{ background: "rgba(212,168,50,0.12)", border: "1px solid rgba(212,168,50,0.3)", color: "hsl(43,74%,58%)" }}
                onClick={() => copyToClipboard(referralLink)}
                disabled={!isConnected}
              >
                {t("common.copy", "复制")}
              </button>
            </div>
            <div className="text-[11px] text-white/40 font-mono truncate">
              {isConnected ? referralLink : "--"}
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Own referral code = own wallet address */}
          <div>
            <div className="text-[13px] font-bold text-white mb-1.5">我的推荐码</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 text-[11px] text-white/45 font-mono truncate">
                {isConnected ? walletAddr : "--"}
              </div>
              {isConnected && (
                <button
                  onClick={() => copyToClipboard(walletAddr)}
                  className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  data-testid="button-copy-own-code"
                >
                  <Copy className="h-3.5 w-3.5 text-white/30" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Upline referrer address */}
          {referrer && (
            <div>
              <div className="text-[12px] font-semibold text-white/50 mb-1">上级地址</div>
              <div className="text-[11px] text-white/30 font-mono break-all">
                {referrer}
              </div>
            </div>
          )}
        </div>

        {/* ── My performance + team stats ── */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* V-rank + performance row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/40">当前等级</span>
              <span className="text-[13px] font-black px-2.5 py-0.5 rounded-lg"
                style={{ background: "rgba(212,168,50,0.12)", border: "1px solid rgba(212,168,50,0.3)", color: "hsl(43,74%,58%)" }}>
                {currentRank}
              </span>
              {ownNode && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                  style={{ background: nodeTierBg, border: `1px solid ${nodeTierBorder}`, color: nodeTierColor }}>
                  {nodeTierLabel}
                </span>
              )}
              <button
                onClick={() => navigate("/profile/referral/info")}
                className="w-6 h-6 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Info className="h-3 w-3 text-white/40" />
              </button>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/30">个人业绩</div>
              <div className="text-[14px] font-black" style={{ color: "hsl(43,74%,58%)" }}>
                {isConnected ? `$${ownUsdt.toFixed(0)}` : "--"}
              </div>
            </div>
          </div>
          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          {/* 3-count row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-[10px] text-white/35 mb-1">直推人数</div>
              <div className="text-[17px] font-black text-white">{isConnected ? directCount : "--"}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/35 mb-1">团队总人数</div>
              <div className="text-[17px] font-black text-white">{isConnected ? teamSize : "--"}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/35 mb-1">团队节点数</div>
              <div className="text-[17px] font-black text-white">
                {isConnected ? (sbTeam?.referrals.filter(r => r.nodeType !== "--").length ?? 0) : "--"}
              </div>
            </div>
          </div>
          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          {/* Team performance row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-white/35 mb-1">直推业绩 (USDT)</div>
              <div className="text-[15px] font-black text-white/80">
                {isConnected ? `$${directUsdt.toFixed(0)}` : "--"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/35 mb-1">团队业绩 (USDT)</div>
              <div className="text-[15px] font-black" style={{ color: "hsl(43,74%,58%)" }}>
                {isConnected ? `$${teamUsdt.toFixed(0)}` : "--"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {([
            { key: "team" as MainTab, label: t("profile.tabTeam"), icon: Network },
            { key: "history" as MainTab, label: t("profile.tabHistory"), icon: History },
          ]).map((tab) => (
            <button
              key={tab.key}
              className="py-3 rounded-xl text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2"
              style={{
                border: mainTab === tab.key
                  ? "1px solid rgba(212,168,50,0.5)"
                  : "1px solid rgba(255,255,255,0.3)",
                color: mainTab === tab.key ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.6)",
                background: mainTab === tab.key ? "rgba(212,168,50,0.1)" : "#181818",
              }}
              onClick={() => setMainTab(tab.key)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {mainTab === "team" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, hsl(43,74%,58%), hsl(43,74%,52%))" }} />
                <span className="text-[13px] font-bold text-white">
                  {t("profile.teamMembersCount", { count: teamData?.teamSize || 0 })}
                </span>
              </div>
              {teamData?.referrals && teamData.referrals.some(r => (r.subReferrals?.length ?? 0) > 0) && (
                <button
                  className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                  style={{
                    background: expandedRefs.size > 0 ? "rgba(212,168,50,0.1)" : "rgba(255,255,255,0.04)",
                    border: expandedRefs.size > 0 ? "1px solid rgba(212,168,50,0.25)" : "1px solid rgba(255,255,255,0.12)",
                    color: expandedRefs.size > 0 ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.4)",
                  }}
                  onClick={() => {
                    if (expandedRefs.size > 0) {
                      setExpandedRefs(new Set());
                    } else {
                      setExpandedRefs(new Set(teamData.referrals.filter(r => (r.subReferrals?.length ?? 0) > 0).map(r => r.id)));
                    }
                  }}
                >
                  {expandedRefs.size > 0 ? t("profile.collapseAll", "收起全部") : t("profile.expandAll", "展开全部")}
                </button>
              )}
            </div>

            {/* Search + rank filter */}
            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("profile.searchMember", "搜索钱包地址 / 后4位")}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder:text-white/20 outline-none focus:border-primary/30"
              />
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {["all", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "none"].map(r => (
                  <button
                    key={r}
                    onClick={() => setRankFilter(r)}
                    className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                    style={{
                      background: rankFilter === r ? "rgba(212,168,50,0.12)" : "rgba(255,255,255,0.03)",
                      border: rankFilter === r ? "1px solid rgba(212,168,50,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: rankFilter === r ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {r === "all" ? t("profile.filterAll", "全部") : r === "none" ? t("profile.filterNoRank", "无等级") : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip first N controls */}
            {teamData?.referrals && teamData.referrals.length > 5 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-[10px] text-white/30 mr-0.5">{t("profile.skipBefore", "压缩前:")}</span>
                {[0, 5, 10, 20, 30, 40, 50].filter(n => n === 0 || n < teamData.referrals.length).map(n => (
                  <button
                    key={n}
                    onClick={() => setSkipCount(n)}
                    className="text-[10px] px-2 py-1 rounded-md transition-all"
                    style={{
                      background: skipCount === n ? "rgba(212,168,50,0.15)" : "rgba(255,255,255,0.03)",
                      border: skipCount === n ? "1px solid rgba(212,168,50,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: skipCount === n ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.4)",
                      fontWeight: skipCount === n ? 700 : 400,
                    }}
                  >
                    {n === 0 ? t("profile.filterAll", "全部") : n}
                  </button>
                ))}
              </div>
            )}

            {!isViewingSelf && (
              <div className="flex items-center gap-1 mb-3 flex-wrap text-[12px]">
                <button
                  className="font-bold transition-colors"
                  style={{ color: "hsl(43,74%,58%)" }}
                  onClick={goToRoot}
                >
                  {t("profile.myTeam")}
                </button>
                {addrStack.map((item, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-white/30" />
                    {idx < addrStack.length - 1 ? (
                      <button
                        className="font-bold"
                        style={{ color: "hsl(43,74%,58%)" }}
                        onClick={() => setAddrStack((prev) => prev.slice(0, idx + 1))}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span className="text-white/50">{item.label}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {!isConnected ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.4)" }}>
                <WalletCards className="h-8 w-8 text-white/25 mx-auto mb-3" />
                <p className="text-[13px] text-white/40">{t("profile.connectToViewTeam")}</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : !teamData?.referrals.length ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.4)" }}>
                <Users className="h-8 w-8 text-white/25 mx-auto mb-3" />
                <p className="text-[13px] text-white/40">{t("profile.noTeamMembers")}</p>
                {!isViewingSelf && (
                  <button
                    className="mt-3 text-[12px] font-bold px-4 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
                    onClick={goBack}
                  >
                    <ArrowLeft className="inline h-3 w-3 mr-1" />{t("profile.goBack")}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {skipCount > 0 && teamData.referrals.length > skipCount && (
                  <div
                    className="rounded-xl p-2.5 text-center text-[11px] text-white/35"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {t("profile.skippedMembers", "已压缩前 {{count}} 个成员", { count: Math.min(skipCount, teamData.referrals.length) })}
                  </div>
                )}
                {teamData.referrals.slice(skipCount).filter((ref) => {
                  // Search filter
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const matchSelf = ref.walletAddress?.toLowerCase().includes(q);
                    const matchSub = ref.subReferrals?.some(sr => sr.walletAddress?.toLowerCase().includes(q));
                    if (!matchSelf && !matchSub) return false;
                  }
                  // Rank filter
                  if (rankFilter !== "all") {
                    if (rankFilter === "none") {
                      const selfMatch = !ref.rank;
                      const subMatch = ref.subReferrals?.some(sr => !sr.rank);
                      if (!selfMatch && !subMatch) return false;
                    } else {
                      const selfMatch = ref.rank === rankFilter;
                      const subMatch = ref.subReferrals?.some(sr => sr.rank === rankFilter);
                      if (!selfMatch && !subMatch) return false;
                    }
                  }
                  return true;
                }).map((ref) => {
                  const subCount = ref.subReferrals?.length || 0;
                  const teamDeposits = ref.subReferrals?.reduce((s, r) => s + Number(r.totalDeposited || 0), 0) || 0;
                  const isExpanded = expandedRefs.has(ref.id);
                  const toggleExpand = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setExpandedRefs(prev => {
                      const next = new Set(prev);
                      if (next.has(ref.id)) next.delete(ref.id); else next.add(ref.id);
                      return next;
                    });
                  };
                  return (
                  <div key={ref.id}>
                    <div
                      className="w-full rounded-xl p-3 flex items-center gap-3 text-left transition-all"
                      style={{
                        background: subCount > 0
                          ? "linear-gradient(135deg, #231e0f, #1a1a1a)"
                          : "#141414",
                        border: subCount > 0
                          ? "1px solid rgba(212,168,50,0.25)"
                          : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {/* Expand/collapse toggle */}
                      {subCount > 0 ? (
                        <button onClick={toggleExpand} className="shrink-0 p-0.5 rounded-md transition-colors" style={{ background: "rgba(255,255,255,0.04)" }}>
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            : <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                          }
                        </button>
                      ) : (
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.2)" }} />
                      )}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => drillInto(ref.walletAddress, shortenAddress(ref.walletAddress))}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-mono text-white/80 truncate">
                              {shortenAddress(ref.walletAddress)}
                            </span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(ref.walletAddress); }}
                              className="shrink-0 p-0.5 rounded transition-colors hover:bg-white/10 cursor-pointer"
                            >
                              <Copy className="h-3 w-3 text-white/30" />
                            </span>
                            {refCode && ref.refCode && (
                              <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(`${window.location.origin}/r/${refCode}/${ref.refCode}`); }}
                                className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 transition-all hover:brightness-125 active:scale-95 cursor-pointer"
                                style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}
                                title={`${window.location.origin}/r/${refCode}/${ref.refCode}`}
                              >
                                <Link2 className="h-2.5 w-2.5" />
                                {t("profile.placementLink", "安置链接")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: subCount > 0 ? "rgba(212,168,50,0.08)" : "rgba(255,255,255,0.04)", color: subCount > 0 ? "rgba(212,168,50,0.7)" : "rgba(255,255,255,0.3)" }}>
                              {t("profile.teamCount", { count: subCount })}
                            </span>
                            <span className="text-[10px] text-white/35">
                              {t("profile.deposits", "Deposits")}: {formatCompact(Number(ref.totalDeposited || 0))}
                            </span>
                            <span className="text-[10px] text-white/25">
                              {t("profile.teamPerformance")}: {formatCompact(teamDeposits)}
                            </span>
                          </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                          style={{ background: "rgba(212,168,50,0.1)", border: "1px solid rgba(212,168,50,0.2)", color: "hsl(43,74%,58%)" }}
                        >
                          {ref.rank}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                        >
                          {ref.nodeType}
                        </span>
                      </div>
                      <button onClick={() => drillInto(ref.walletAddress, shortenAddress(ref.walletAddress))} className="shrink-0">
                        <ChevronRight className="h-3.5 w-3.5 text-white/30" />
                      </button>
                    </div>
                    {isExpanded && ref.subReferrals && ref.subReferrals.length > 0 && (
                      <div className="ml-5 mt-1.5 space-y-1.5 border-l-2 pl-3" style={{ borderColor: "rgba(212,168,50,0.15)" }}>
                        {ref.subReferrals.map((sub) => {
                          const hasTeam = (sub.subCount || 0) > 0;
                          return (
                          <button
                            key={sub.id}
                            className="w-full rounded-lg p-2.5 flex items-center gap-2.5 text-left transition-all active:scale-[0.98]"
                            style={{
                              background: hasTeam ? "linear-gradient(135deg, rgba(212,168,50,0.04), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.03)",
                              border: hasTeam ? "1px solid rgba(212,168,50,0.2)" : "1px solid rgba(255,255,255,0.1)",
                            }}
                            onClick={() => drillInto(sub.walletAddress, shortenAddress(sub.walletAddress))}
                          >
                            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: hasTeam ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.2)" }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono text-white/60 truncate">
                                  {shortenAddress(sub.walletAddress)}
                                </span>
                                {refCode && sub.refCode && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyToClipboard(`${window.location.origin}/r/${refCode}/${sub.refCode}`); }}
                                    className="shrink-0 px-1 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 transition-all hover:brightness-125 active:scale-95"
                                    style={{ background: "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.2)", color: "#facc15" }}
                                    title={`${window.location.origin}/r/${refCode}/${sub.refCode}`}
                                  >
                                    <Link2 className="h-2 w-2" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: hasTeam ? "rgba(212,168,50,0.08)" : "rgba(255,255,255,0.04)", color: hasTeam ? "rgba(212,168,50,0.7)" : "rgba(255,255,255,0.3)" }}>
                                  {t("profile.teamCount", { count: sub.subCount || 0 })}
                                </span>
                              </div>
                            </div>
                            <span
                              className="text-[11px] px-2 py-0.5 rounded font-bold shrink-0"
                              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                            >
                              {sub.rank}
                            </span>
                            <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mainTab === "history" && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, hsl(43,74%,58%), hsl(43,74%,52%))" }} />
              <span className="text-[13px] font-bold text-white">{t("profile.tabHistory")}</span>
            </div>

            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              {([
                { key: "all" as HistoryFilter, label: "全部" },
                { key: "direct" as HistoryFilter, label: "直推佣金" },
                { key: "diff" as HistoryFilter, label: "差异奖励" },
                { key: "same_rank" as HistoryFilter, label: "平级奖励" },
                { key: "override" as HistoryFilter, label: "越级奖励" },
                { key: "node_reward" as HistoryFilter, label: "节点收益" },
              ]).map((f) => (
                <button
                  key={f.key}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
                  style={{
                    background: historyFilter === f.key ? "rgba(212,168,50,0.12)" : "rgba(255,255,255,0.04)",
                    border: historyFilter === f.key ? "1px solid rgba(212,168,50,0.35)" : "1px solid rgba(255,255,255,0.12)",
                    color: historyFilter === f.key ? "hsl(43,74%,58%)" : "rgba(255,255,255,0.45)",
                  }}
                  onClick={() => setHistoryFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!isConnected ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                <WalletCards className="h-8 w-8 text-white/25 mx-auto mb-3" />
                <p className="text-[13px] text-white/40">{t("profile.connectToViewCommission")}</p>
              </div>
            ) : historyFilter === "node_reward" ? (
              nodeRewardsLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
              ) : !nodeRewards?.length ? (
                <div className="py-16 text-center text-white/30 text-[13px]">{t("profile.noHistoryData")}</div>
              ) : (
                <div className="space-y-2">
                  {nodeRewards.map((rec: any) => {
                    const rType = rec.rewardType || rec.reward_type || "FIXED_YIELD";
                    const amount = Number(rec.amount || 0);
                    const createdAt = (rec.createdAt || rec.created_at)
                      ? new Date(rec.createdAt || rec.created_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "--";
                    const isFixed = rType === "FIXED_YIELD";
                    const color = isFixed ? "#10b981" : "#f59e0b";
                    const bg = isFixed ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)";
                    const label = isFixed ? "节点固定收益" : "节点分红";
                    return (
                      <div key={rec.id} className="rounded-xl p-3 flex items-center justify-between"
                        style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                            <ServerIcon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: bg, color }}>{label}</span>
                            <div className="text-[9px] text-white/25 mt-0.5">{createdAt}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-bold" style={{ color }}>+{amount.toFixed(2)} MA</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : commissionLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-16 text-center text-white/30 text-[13px]">
                {t("profile.noHistoryData")}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRecords.map((record: any) => {
                  const rType = record.details?.type || "unknown";
                  const amount = Number(record.amount || 0);
                  const depth = record.details?.depth || 0;
                  const createdAt = record.createdAt
                    ? new Date(record.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "--";

                  const typeConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
                    direct_referral: { label: t("profile.directReward", "直推奖励"), color: "#ec4899", bg: "rgba(236,72,153,0.1)", icon: UserPlus },
                    differential: { label: t("profile.teamDiff", "团队级差"), color: "#6366f1", bg: "rgba(99,102,241,0.1)", icon: Layers },
                    same_rank: { label: t("profile.sameRank", "同级奖励"), color: "#a855f7", bg: "rgba(168,85,247,0.1)", icon: Users },
                    override: { label: t("profile.override", "越级奖励"), color: "#eab308", bg: "rgba(234,179,8,0.1)", icon: Network },
                  };
                  const cfg = typeConfig[rType] || { label: rType, color: "#9ca3af", bg: "rgba(156,163,175,0.1)", icon: DollarSign };
                  const Icon = cfg.icon;

                  return (
                    <div key={record.id} className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                          <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            {depth > 0 && <span className="text-[9px] text-white/25">L{depth}</span>}
                          </div>
                          <div className="text-[10px] text-white/30 mt-0.5 truncate">
                            {record.sourceWallet ? shortenAddress(record.sourceWallet) : "--"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold" style={{ color: cfg.color }}>+{amount.toFixed(2)} MA</div>
                        <div className="text-[9px] text-white/25">{createdAt}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
