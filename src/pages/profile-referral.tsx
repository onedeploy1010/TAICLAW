import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress, formatCompact } from "@/lib/constants";
import { useMaPrice } from "@/hooks/use-ma-price";
import { ArrowLeft, Copy, Users, UserPlus, DollarSign, WalletCards, Layers, ChevronRight, ChevronDown, History, Network, Link2 } from "lucide-react";
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
type HistoryFilter = "all" | "deposit" | "redeem" | "direct" | "diff" | "same_rank" | "override";

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
    totalMembers: number; totalPurchases: number; totalUsdt: number; superNodes: number; stdNodes: number;
  }>({
    queryKey: ["supabase-global-stats"],
    queryFn: async () => { const r = await fetch("/api/supabase/global-stats"); return r.json(); },
  });

  const { data: sbTeam, isLoading } = useQuery<{
    referrals: ReferralMember[]; teamSize: number; directCount: number;
    ownNode: { nodeId: number; nodeTier: string; usdtAmount: number } | null;
    referrer: string | null;
  }>({
    queryKey: ["supabase-team", viewingAddr],
    queryFn: async () => { const r = await fetch(`/api/supabase/team/${viewingAddr}`); return r.json(); },
    enabled: isConnected,
  });

  // Commission history still from Neon DB
  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ["commission", walletAddr],
    queryFn: () => getCommissionRecords(walletAddr) as Promise<CommissionSummary>,
    enabled: isConnected,
  });

  const totalCommission = Number(commission?.totalCommission || 0);
  const directTotal = Number(commission?.directReferralTotal || 0);
  const diffTotal = Number(commission?.differentialTotal || 0);
  const sameRankTotal = Number(commission?.sameRankTotal || 0);
  const overrideTotal = Number(commission?.overrideTotal || 0);

  const refCode = profile?.refCode;
  const referralLink = refCode ? `${window.location.origin}/r/${refCode}/${refCode}` : "--";

  // Use Supabase data for team stats
  const teamData = sbTeam;
  const ownNode   = sbTeam?.ownNode || null;
  const referrer  = sbTeam?.referrer || (profile as any)?.parentWallet || null;
  const directCount = sbTeam?.directCount ?? 0;
  const teamSize    = sbTeam?.teamSize ?? 0;

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

          {/* ── Node Tier Card ── */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, hsl(43,74%,58%), hsl(43,74%,52%))" }} />
              <span className="text-[13px] font-bold text-white">我的节点等级</span>
            </div>
            <span className="text-[12px] font-black px-3 py-1 rounded-lg"
              style={{ background: nodeTierBg, border: `1px solid ${nodeTierBorder}`, color: nodeTierColor }}>
              {nodeTierLabel}
            </span>
          </div>

          {/* Three-tier progress track */}
          <div className="relative mb-4 rounded-2xl overflow-hidden p-4"
            style={{ background: "linear-gradient(145deg, rgba(20,16,8,0.95), rgba(14,12,6,0.98))", border: "1px solid rgba(212,168,50,0.12)" }}>
            <div className="absolute top-0 right-0 w-28 h-28 opacity-15" style={{ background: "radial-gradient(circle, rgba(212,168,50,0.5), transparent 70%)", filter: "blur(24px)" }} />
            {/* Tier track */}
            <div className="relative flex items-center justify-between px-2">
              {/* Track line background */}
              <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px]" style={{ background: "rgba(255,255,255,0.06)" }} />
              {/* Active segment */}
              <div className="absolute left-8 top-1/2 -translate-y-1/2 h-[2px] transition-all duration-700"
                style={{ width: isSuper ? "calc(100% - 64px)" : isStd ? "50%" : "0%", background: "linear-gradient(90deg, #60a5fa, #f59e0b)", boxShadow: "0 0 6px rgba(212,168,50,0.3)" }} />
              {[
                { label: "注册会员", color: "rgba(255,255,255,0.4)",  bg: "rgba(255,255,255,0.05)", active: true,    border: "rgba(255,255,255,0.15)" },
                { label: "标准节点", color: isStd||isSuper ? "#60a5fa" : "rgba(255,255,255,0.2)", bg: isStd||isSuper ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.03)", active: isStd||isSuper, border: isStd||isSuper ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.08)" },
                { label: "超级节点", color: isSuper ? "#f59e0b" : "rgba(255,255,255,0.2)", bg: isSuper ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)", active: isSuper, border: isSuper ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)" },
              ].map((tier, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center gap-1.5">
                  {tier.active && (
                    <div className="absolute w-12 h-12 rounded-full" style={{ background: `${tier.color}22`, animation: "pulse 2.5s ease-in-out infinite", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
                  )}
                  <div className="relative w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: tier.bg, border: `2px solid ${tier.border}`, boxShadow: tier.active ? `0 0 12px ${tier.color}44` : "none" }}>
                    <span className="text-[9px] font-black text-center leading-tight" style={{ color: tier.color }}>{i === 0 ? "会员" : i === 1 ? "标准" : "超级"}</span>
                  </div>
                  <span className="text-[8px] text-center whitespace-nowrap" style={{ color: tier.color }}>{tier.label}</span>
                </div>
              ))}
            </div>

            {/* My node info row */}
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/30 mb-0.5">节点投入</div>
                <div className="text-[15px] font-black" style={{ color: nodeTierColor }}>
                  {ownNode ? `$${Number(ownNode.usdtAmount).toLocaleString()} USDT` : "--"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 mb-0.5">直推佣金</div>
                <div className="text-[15px] font-black" style={{ color: nodeTierColor }}>
                  {isSuper ? "15%" : isStd ? "10%" : "0%"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 mb-0.5">团队级差</div>
                <div className="text-[15px] font-black" style={{ color: nodeTierColor }}>
                  {isSuper ? "5-10%" : isStd ? "5%" : "0%"}
                </div>
              </div>
            </div>
          </div>

          {/* ── Official Tier Requirements Table ── */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, hsl(43,74%,58%), hsl(43,74%,52%))" }} />
            <span className="text-[13px] font-bold text-white">等级要求 & 奖励</span>
          </div>

          <div className="rounded-2xl overflow-hidden mb-1" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* Header */}
            <div className="grid grid-cols-4 gap-0 px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["等级", "节点费用", "直推奖励", "团队奖励"].map(h => (
                <div key={h} className="text-[9px] font-bold text-white/30 text-center">{h}</div>
              ))}
            </div>
            {/* Rows */}
            {[
              { label: "注册会员", price: "免费",     direct: "—",   team: "—",      active: !isStd && !isSuper, color: "rgba(255,255,255,0.5)" },
              { label: "标准节点", price: "$1,000",   direct: "10%", team: "5%",     active: isStd,   color: "#60a5fa" },
              { label: "超级节点", price: "$2,500",   direct: "15%", team: "5-10%",  active: isSuper, color: "#f59e0b" },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-0 px-3 py-2.5 items-center"
                style={{ background: row.active ? `${row.color}0d` : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div className="flex items-center gap-1.5">
                  {row.active && <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: row.color }} />}
                  <span className="text-[10px] font-bold" style={{ color: row.active ? row.color : "rgba(255,255,255,0.4)" }}>{row.label}</span>
                </div>
                <div className="text-[10px] text-center" style={{ color: row.active ? row.color : "rgba(255,255,255,0.3)" }}>{row.price}</div>
                <div className="text-[11px] font-bold text-center" style={{ color: row.active ? row.color : "rgba(255,255,255,0.25)" }}>{row.direct}</div>
                <div className="text-[11px] font-bold text-center" style={{ color: row.active ? row.color : "rgba(255,255,255,0.25)" }}>{row.team}</div>
              </div>
            ))}
          </div>

          {/* ── Global Stats Strip ── */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {[
              { label: "全球会员", value: globalStats ? `${globalStats.totalMembers}` : "--" },
              { label: "超级节点", value: globalStats ? `${globalStats.superNodes}` : "--" },
              { label: "标准节点", value: globalStats ? `${globalStats.stdNodes}` : "--" },
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
        <div className="rounded-2xl p-4 space-y-4" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.4)" }}>
          <div>
            <div className="text-[13px] font-bold text-white mb-1">上级推荐人</div>
            <div className="text-[12px] text-white/45 font-mono">
              {referrer ? shortenAddress(referrer) : "--"}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold text-white">{t("profile.inviteLink")}</span>
              <button
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all active:scale-95"
                style={{ background: "rgba(212,168,50,0.12)", border: "1px solid rgba(212,168,50,0.3)", color: "hsl(43,74%,58%)" }}
                onClick={() => copyToClipboard(referralLink)}
              >
                {refCode ? t("common.copy") : t("profile.generateInvite")}
              </button>
            </div>
            <div className="text-[11px] text-white/40 font-mono truncate">{referralLink}</div>
            <div className="h-px mt-2" style={{ background: "linear-gradient(90deg, transparent, rgba(212,168,50,0.3), transparent)" }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold text-white">{t("profile.inviteCode")}</span>
              <button
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all active:scale-95"
                style={{ background: "rgba(212,168,50,0.12)", border: "1px solid rgba(212,168,50,0.3)", color: "hsl(43,74%,58%)" }}
                onClick={() => copyToClipboard(refCode || "")}
              >
                {refCode ? t("common.copy") : t("profile.generateInvite")}
              </button>
            </div>
            <div className="text-[11px] text-white/40 font-mono">{refCode || "--"}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl p-3.5 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.4)" }}>
            <div className="text-[11px] text-white/50 font-medium mb-2">直推人数</div>
            <UserPlus className="h-5 w-5 mx-auto text-white/50 mb-1.5" />
            <div className="text-[18px] font-black text-white">{isConnected ? directCount : "--"}</div>
          </div>
          <div className="rounded-xl p-3.5 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] text-white/50 font-medium mb-2">团队总人数</div>
            <Users className="h-5 w-5 mx-auto text-white/50 mb-1.5" />
            <div className="text-[18px] font-black text-white">{isConnected ? teamSize : "--"}</div>
          </div>
          <div className="rounded-xl p-3.5 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] text-white/50 font-medium mb-2">团队节点数</div>
            <DollarSign className="h-5 w-5 mx-auto text-white/50 mb-1.5" />
            <div className="text-[18px] font-black text-white">
              {isConnected ? (sbTeam?.referrals.filter(r => r.nodeType !== "--").length ?? 0) : "--"}
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
                {["all", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "none"].map(r => (
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
                      <div className="flex-1 min-w-0">
                        <button
                          className="text-left w-full"
                          onClick={() => drillInto(ref.walletAddress, shortenAddress(ref.walletAddress))}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-mono text-white/80 truncate">
                              {shortenAddress(ref.walletAddress)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyToClipboard(ref.walletAddress); }}
                              className="shrink-0 p-0.5 rounded transition-colors hover:bg-white/10"
                            >
                              <Copy className="h-3 w-3 text-white/30" />
                            </button>
                            {refCode && ref.refCode && (
                              <button
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyToClipboard(`${window.location.origin}/r/${refCode}/${ref.refCode}`); }}
                                className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 transition-all hover:brightness-125 active:scale-95"
                                style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}
                                title={`${window.location.origin}/r/${refCode}/${ref.refCode}`}
                              >
                                <Link2 className="h-2.5 w-2.5" />
                                {t("profile.placementLink", "安置链接")}
                              </button>
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
                        </button>
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
                { key: "all" as HistoryFilter, label: t("profile.historyAll", "全部") },
                { key: "direct" as HistoryFilter, label: t("profile.historyDirect", "直推奖励") },
                { key: "diff" as HistoryFilter, label: t("profile.historyDiff", "团队级差") },
                { key: "same_rank" as HistoryFilter, label: t("profile.historySameRank", "同级奖励") },
                { key: "override" as HistoryFilter, label: t("profile.historyOverride", "越级奖励") },
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
              <div className="rounded-2xl p-8 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.4)" }}>
                <WalletCards className="h-8 w-8 text-white/25 mx-auto mb-3" />
                <p className="text-[13px] text-white/40">{t("profile.connectToViewCommission")}</p>
              </div>
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
                    <div
                      key={record.id}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                          <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
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
