import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback, useMemo, type ComponentType } from "react";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress, formatCompact } from "@/lib/constants";
import {
  ArrowLeft, Copy, CheckCircle2, Users, UserPlus, DollarSign,
  WalletCards, Layers, ChevronRight, History, Network, Gift,
  Info, ServerIcon, Coins, TrendingUp, BarChart2, Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getProfile, getCommissionRecords } from "@/lib/api";
import type { Profile, CommissionSummary } from "@shared/types";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const EASE = [0.22, 1, 0.36, 1] as const;

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

type MainTab = "team" | "history" | "chart";
type HistoryFilter = "all" | "direct" | "diff" | "same_rank" | "override" | "node_reward";

/* ── Shared local copy-button ─────────────────────────────────────────────── */
function CopyableAddress({
  address,
  short: isShort = false,
  className = "",
}: {
  address: string;
  short?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = address;
  const shortDisplay = address.length > 10
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback */ }
  }
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 font-mono text-[11px] sm:text-xs transition-colors duration-300 ${copied ? "border-emerald-500/50 bg-emerald-500/5" : "hover:border-amber-500/55"} ${className}`}
      title={display}
    >
      <span className={isShort ? "" : "select-all"}>{isShort ? shortDisplay : display}</span>
      <button
        type="button"
        onClick={copy}
        className={`rounded-sm transition-all duration-200 shrink-0 ${copied ? "animate-copy-pop text-emerald-400" : "opacity-60 hover:opacity-100 hover:text-amber-400"}`}
        aria-label="Copy address"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

/* ── Animated KPI tile (from official dashboard) ─────────────────────────── */
function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  highlight = false,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  highlight?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      whileHover={{ y: -3 }}
      className={`group relative border rounded-xl p-4 sm:p-5 corner-brackets overflow-hidden surface-3d transition-all duration-300 ${
        highlight
          ? "border-amber-500/60 bg-gradient-to-br from-amber-900/45 via-slate-800/75 to-slate-700/85 hover:border-amber-400/80 hover:shadow-[0_0_36px_rgba(251,191,36,0.40),inset_0_1px_0_rgba(251,191,36,0.25)]"
          : "border-amber-500/30 bg-gradient-to-br from-amber-950/25 via-slate-800/70 to-slate-700/80 hover:border-amber-500/55 hover:shadow-[0_0_24px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(251,191,36,0.10)]"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_75%_-20%,rgba(251,191,36,0.14),transparent_55%)]"
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-[0.20em] text-muted-foreground/85">{label}</span>
        {Icon && (
          <Icon className={`h-4 w-4 transition-colors ${highlight ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-amber-500/60 group-hover:text-amber-400"}`} />
        )}
      </div>
      <div className={`relative text-2xl sm:text-3xl num tabular-nums ${highlight ? "num-gold" : "text-foreground"}`}>{value}</div>
      {sub && <div className="relative text-xs text-muted-foreground/80 mt-1.5 tracking-[0.14em] uppercase">{sub}</div>}
    </motion.div>
  );
}

/* ── Breadcrumb: Root (You) › addr1 › addr2 ─────────────────────────────── */
function TeamBreadcrumb({
  walletAddr,
  addrStack,
  onJumpToRoot,
  onJumpTo,
}: {
  walletAddr: string;
  addrStack: Array<{ addr: string; label: string }>;
  onJumpToRoot: () => void;
  onJumpTo: (idx: number) => void;
}) {
  const isRoot = addrStack.length === 0;
  return (
    <div className="flex items-center gap-1 flex-wrap text-xs">
      {/* Root chip */}
      {isRoot ? (
        <span className="font-mono px-2 py-1 rounded-md text-[11px] bg-amber-950/30 border border-amber-700/40 text-amber-200">
          ROOT (You)
        </span>
      ) : (
        <button
          type="button"
          onClick={onJumpToRoot}
          className="font-mono px-2 py-1 rounded-md text-[11px] text-amber-300/80 hover:text-amber-300 hover:bg-amber-950/20 transition-colors"
        >
          ROOT (You)
        </button>
      )}
      {addrStack.map((item, i) => {
        const isLast = i === addrStack.length - 1;
        return (
          <div key={`${item.addr}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/82" />
            {isLast ? (
              <span className="font-mono px-2 py-1 rounded-md text-[11px] bg-card/60 border border-border/50 text-foreground">
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onJumpTo(i)}
                className="font-mono px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors"
              >
                {item.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Focus header: current wallet being viewed ───────────────────────────── */
function FocusHeader({
  address,
  isSelf,
  depth,
  nodeType,
  rank,
  directCount,
  teamSize,
}: {
  address: string;
  isSelf: boolean;
  depth: number;
  nodeType?: string;
  rank?: string;
  directCount?: number;
  teamSize?: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap transition-all duration-300 ${
      isSelf
        ? "border-amber-500/55 bg-gradient-to-br from-amber-950/35 via-amber-950/15 to-slate-950/40 shadow-[inset_0_1px_0_rgba(251,191,36,0.12),0_8px_24px_-12px_rgba(251,191,36,0.3)]"
        : "border-amber-500/28 bg-gradient-to-br from-amber-950/18 to-slate-800/80 hover:border-amber-500/50 hover:shadow-[0_0_16px_rgba(251,191,36,0.12)]"
    }`}>
      {isSelf && (
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_55%)] pointer-events-none" />
      )}
      <div className="relative flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] uppercase tracking-[0.2em] font-semibold px-1.5 py-0.5 rounded border ${
          isSelf
            ? "text-amber-200 border-amber-500/50 bg-amber-500/10 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]"
            : "text-amber-500/70 border-amber-500/30 bg-amber-500/[0.06]"
        }`}>
          {isSelf ? "ROOT" : `L${depth}`}
        </span>
        <CopyableAddress
          address={address}
          short
          className={isSelf ? "!border-amber-500/40 !bg-amber-500/10 !text-amber-100" : ""}
        />
      </div>
      <div className="relative flex items-center gap-2 flex-wrap sm:ml-auto">
        {rank && (
          <span className="text-[11px] px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold">{rank}</span>
        )}
        {nodeType && nodeType !== "--" && (
          <span className="text-[11px] px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/[0.07] text-amber-400/80">{nodeType}</span>
        )}
        {directCount !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            👥 {directCount} 直推 · {teamSize ?? 0} 总人数
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Team row (clickable drill-down) ─────────────────────────────────────── */
function TeamRow({
  member,
  onDrill,
  copyToClipboard,
}: {
  member: ReferralMember;
  onDrill: () => void;
  copyToClipboard: (text: string) => void;
}) {
  const subCount = member.subReferrals?.length || 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <motion.div
        whileHover={{ x: 2 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg border border-amber-500/28 bg-gradient-to-r from-amber-950/18 to-slate-800/60 hover:border-amber-500/55 hover:bg-amber-500/[0.08] hover:shadow-[0_4px_20px_-8px_rgba(251,191,36,0.3)] transition-all duration-300 flex-wrap group"
      >
        {/* Expand toggle */}
        {subCount > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-white/10"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90 text-amber-400" : "text-white/40"}`} />
          </button>
        ) : (
          <div className="h-2 w-2 rounded-full shrink-0 bg-white/20" />
        )}

        {/* Address + copy */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onDrill}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-mono text-white/80 truncate">
              {shortenAddress(member.walletAddress)}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); copyToClipboard(member.walletAddress); }}
              className="shrink-0 p-0.5 rounded transition-colors hover:bg-white/10"
            >
              <Copy className="h-3 w-3 text-white/30" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/[0.08] text-amber-400/70">
              👥 {subCount}
            </span>
            <span className="text-[10px] text-white/35">
              ${formatCompact(Number(member.totalDeposited || 0))} USDT
            </span>
          </div>
        </div>

        {/* Rank + node type */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {member.rank && (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-500/25 bg-amber-500/10 text-amber-300">
              {member.rank}
            </span>
          )}
          {member.nodeType && member.nodeType !== "--" && (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-500/30 bg-amber-500/[0.07] text-amber-400/80">
              {member.nodeType}
            </span>
          )}
        </div>

        {/* Drill arrow */}
        <button type="button" onClick={onDrill} className="shrink-0">
          <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-300" />
        </button>
      </motion.div>

      {/* Sub-referrals expand */}
      {expanded && member.subReferrals && member.subReferrals.length > 0 && (
        <div className="ml-5 mt-1.5 space-y-1.5 border-l-2 pl-3" style={{ borderColor: "rgba(251,191,36,0.15)" }}>
          {member.subReferrals.map((sub) => {
            const hasTeam = (sub.subCount || 0) > 0;
            return (
              <div
                key={sub.id}
                className="w-full rounded-lg p-2.5 flex items-center gap-2.5 text-left transition-all"
                style={{
                  background: hasTeam ? "linear-gradient(135deg, rgba(251,191,36,0.04), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.03)",
                  border: hasTeam ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: hasTeam ? "#f59e0b" : "rgba(255,255,255,0.2)" }} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-mono text-white/60 truncate">
                    {shortenAddress(sub.walletAddress)}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: hasTeam ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)", color: hasTeam ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.3)" }}>
                      👥 {sub.subCount || 0}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded font-bold shrink-0 bg-white/[0.05] text-white/40">
                  {sub.rank}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════════════════════ */
export default function ProfileReferralPage() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;

  const [mainTab, setMainTab] = useState<MainTab>("team");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  const [addrStack, setAddrStack] = useState<Array<{ addr: string; label: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const viewingAddr = addrStack.length > 0 ? addrStack[addrStack.length - 1].addr : walletAddr;
  const isViewingSelf = viewingAddr === walletAddr;

  const drillInto = useCallback((addr: string, label: string) => {
    setAddrStack((prev) => [...prev, { addr, label }]);
  }, []);

  const goToRoot = useCallback(() => setAddrStack([]), []);

  const jumpTo = useCallback((idx: number) => {
    setAddrStack((prev) => prev.slice(0, idx + 1));
  }, []);

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile", walletAddr],
    queryFn: () => getProfile(walletAddr),
    enabled: isConnected,
  });

  const { data: globalStats } = useQuery<{
    totalMembers: number; activeMembers: number; totalNodes: number;
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

  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ["commission", walletAddr],
    queryFn: () => getCommissionRecords(walletAddr) as Promise<CommissionSummary>,
    enabled: isConnected,
  });

  const { data: nodeRewards, isLoading: nodeRewardsLoading } = useQuery<any[]>({
    queryKey: ["node-rewards", walletAddr],
    queryFn: async () => {
      const r = await fetch(`/api/node-rewards/${encodeURIComponent(walletAddr)}`);
      const d = await r.json();
      return d?.rewards ?? [];
    },
    enabled: isConnected,
  });

  const refCode = profile?.refCode;
  const referralLink = walletAddr ? `${window.location.origin}/r/${walletAddr}` : "--";
  const rawReferrer = sbTeam?.referrer || (profile as any)?.parentWallet || null;
  const referrer = rawReferrer && rawReferrer.toLowerCase() !== walletAddr.toLowerCase() ? rawReferrer : null;
  const currentRank = profile?.rank || "V0";
  const directCount = sbTeam?.directCount ?? 0;
  const teamSize    = sbTeam?.teamSize ?? 0;
  const ownUsdt   = sbTeam?.ownUsdt ?? 0;
  const directUsdt = sbTeam?.directUsdt ?? 0;
  const teamUsdt  = sbTeam?.teamUsdt ?? 0;
  const ownNode   = sbTeam?.ownNode || null;
  const isSuper = ownNode?.nodeId === 401;
  const isStd   = ownNode?.nodeId === 501;
  const nodeTierLabel = isSuper ? "超级节点" : isStd ? "标准节点" : null;

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

  const filteredReferrals = sbTeam?.referrals.filter((ref) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return ref.walletAddress?.toLowerCase().includes(q) ||
      ref.subReferrals?.some(sr => sr.walletAddress?.toLowerCase().includes(q));
  }) || [];

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pt-4" style={{ background: "#050505" }} data-testid="page-profile-referral">

      {/* ── Page ambient glow ── */}
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute top-[55%] right-[8%] w-[400px] h-[400px] rounded-full bg-amber-500/[0.02] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-amber-500/10" style={{ background: "linear-gradient(180deg, rgba(28,20,8,0.95) 0%, rgba(10,10,10,0) 100%)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(251,191,36,0.08),transparent_55%)] pointer-events-none" />
        <div className="relative px-4 pt-3 pb-5">
          <div className="flex items-center justify-center relative mb-4 lg:justify-start">
            <button
              onClick={() => navigate("/profile")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors lg:hidden hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ArrowLeft className="h-5 w-5 text-white/90" />
            </button>
            <h1 className="text-[17px] font-bold tracking-wide text-white">{t("profile.promotionCenter")}</h1>
          </div>

          {/* Global stats strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "全球会员", value: globalStats ? String(globalStats.totalMembers) : "…" },
              { label: "激活会员", value: globalStats ? String(globalStats.activeMembers) : "…" },
              { label: "总节点数", value: globalStats ? String(globalStats.totalNodes) : "…" },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
                className="rounded-xl p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="text-[9px] text-white/30 mb-1 uppercase tracking-widest">{s.label}</div>
                <div className="text-[16px] font-black num text-white">{s.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* ── Invite card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
        >
          <Card className="surface-3d relative overflow-hidden bg-gradient-to-br from-slate-700/80 to-slate-800/90 border-amber-500/40">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/20 via-transparent to-transparent blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_55%)] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
            <CardContent className="pt-4 pb-4 space-y-3 relative z-10">
              {/* Invite link */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-white">{t("profile.inviteLink", "邀请链接")}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-amber-500/15 bg-black/40 px-3 py-2 text-[11px] font-mono text-foreground/75 truncate">
                    {isConnected ? referralLink : "--"}
                  </div>
                  <button
                    className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold transition-all gap-1.5 border flex items-center ${
                      !isConnected ? "opacity-40 cursor-not-allowed" : "hover:bg-amber-500/20 hover:border-amber-400/50"
                    } border-amber-500/30 bg-amber-500/5 text-amber-300`}
                    onClick={() => copyToClipboard(referralLink)}
                    disabled={!isConnected}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t("common.copy", "复制")}
                  </button>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

              {/* My referral code = own wallet */}
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-1.5 uppercase tracking-widest">我的推荐码</div>
                <CopyableAddress address={isConnected ? walletAddr : "--"} short={false} className="text-[10px]" />
              </div>

              {/* Upline */}
              {referrer && (
                <>
                  <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
                  <div>
                    <div className="text-[11px] text-muted-foreground/70 mb-1.5 uppercase tracking-widest">上级地址</div>
                    <CopyableAddress address={referrer} short className="text-[10px]" />
                  </div>
                </>
              )}

              {/* Rank + node badge */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground/70">当前等级</span>
                <span className="text-[12px] font-black px-2.5 py-0.5 rounded-lg border border-amber-500/30 bg-amber-500/12 text-amber-300">
                  {currentRank}
                </span>
                {nodeTierLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-500/30 bg-amber-500/[0.07] text-amber-400/80">
                    {nodeTierLabel}
                  </span>
                )}
                <button
                  onClick={() => navigate("/profile/referral/info")}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <Info className="h-3 w-3 text-white/40" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── KPI stats grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={Users}      label="直推人数"       value={isConnected ? String(directCount) : "…"}          sub="直接邀请"    delay={0.10} />
          <Kpi icon={Users}      label="团队总人数"      value={isConnected ? String(teamSize) : "…"}             sub="递归统计"    delay={0.14} />
          <Kpi icon={Coins}      label="直推业绩"        value={isConnected ? `$${directUsdt.toFixed(0)}` : "…"} sub="USDT"       delay={0.18} />
          <Kpi icon={TrendingUp} label="团队业绩"        value={isConnected ? `$${teamUsdt.toFixed(0)}` : "…"}   sub="USDT"       delay={0.22} highlight />
        </div>

        {/* ── Tab switcher ── */}
        <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-950/30 p-1 text-[12px] relative">
          {([
            { key: "team"    as MainTab, label: t("profile.tabTeam"),    icon: Network    },
            { key: "history" as MainTab, label: t("profile.tabHistory"), icon: History    },
            { key: "chart"   as MainTab, label: "图表",                  icon: BarChart2  },
          ]).map((tab) => {
            const active = mainTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMainTab(tab.key)}
                className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition-all duration-300 ${
                  active ? "text-amber-900" : "text-muted-foreground/77 hover:text-white/80"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="referralTabPill"
                    className="absolute inset-0 rounded-full bg-amber-400"
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
                <tab.icon className="relative h-3.5 w-3.5 z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {mainTab === "team" ? (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-3"
            >
              {/* Search bar */}
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("profile.searchMember", "搜索钱包地址 / 后4位")}
                className="w-full rounded-xl border border-amber-500/28 bg-amber-950/20 px-3 py-2 text-[12px] text-white/80 placeholder:text-amber-200/20 outline-none focus:border-amber-500/55 focus:shadow-[0_0_16px_rgba(251,191,36,0.15)] transition-all duration-300"
              />

              {/* Team tree card */}
              <Card className="surface-3d relative overflow-hidden bg-gradient-to-br from-slate-700/85 to-slate-700/90 border-amber-500/50">
                <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-amber-500/20 via-transparent to-transparent blur-3xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_55%)] pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
                <CardHeader className="pb-3 border-b border-amber-500/15 relative z-10">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
                    团队成员 ({teamSize})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 relative z-10">
                  {/* Breadcrumb */}
                  <TeamBreadcrumb
                    walletAddr={walletAddr}
                    addrStack={addrStack}
                    onJumpToRoot={goToRoot}
                    onJumpTo={jumpTo}
                  />

                  {/* Focus header */}
                  <FocusHeader
                    address={viewingAddr}
                    isSelf={isViewingSelf}
                    depth={addrStack.length}
                    rank={isViewingSelf ? currentRank : undefined}
                    nodeType={isViewingSelf && nodeTierLabel ? nodeTierLabel : undefined}
                    directCount={directCount}
                    teamSize={teamSize}
                  />

                  {/* Member list */}
                  <div className="space-y-1.5">
                    {!isConnected ? (
                      <div className="py-10 text-center">
                        <WalletCards className="h-6 w-6 mx-auto mb-2 text-white/25" />
                        <p className="text-[13px] text-white/40">{t("profile.connectToViewTeam")}</p>
                      </div>
                    ) : isLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                      </div>
                    ) : !filteredReferrals.length ? (
                      <div className="py-8 text-center">
                        <Users className="h-6 w-6 mx-auto mb-2 text-white/25" />
                        <p className="text-[13px] text-muted-foreground">
                          {!isViewingSelf ? t("mr.dash.team.noDownstream", "该成员暂无下级") : t("profile.noTeamMembers")}
                        </p>
                        {!isViewingSelf && (
                          <button
                            className="mt-3 text-[12px] font-bold px-4 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300 transition-all hover:bg-amber-500/20"
                            onClick={goToRoot}
                          >
                            <ArrowLeft className="inline h-3 w-3 mr-1" />返回
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredReferrals.map((ref) => (
                        <TeamRow
                          key={ref.id}
                          member={ref}
                          onDrill={() => drillInto(ref.walletAddress, shortenAddress(ref.walletAddress))}
                          copyToClipboard={copyToClipboard}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <p className="text-[11px] text-muted-foreground/60 text-center">
                数据来自链上索引，更新延迟约 5 分钟
              </p>
            </motion.div>
          ) : mainTab === "history" ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-3"
            >
              {/* ── Rewards KPI row (from official RewardsTab) ── */}
              {isConnected && (() => {
                const directRecs   = commission?.records?.filter((r: any) => r.details?.type === "direct_referral") ?? [];
                const totalComm    = commission?.records?.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0) ?? 0;
                const nrTotal      = nodeRewards?.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0) ?? 0;
                return (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Users, label: "直推笔数",     value: String(directRecs.length),              sub: "direct referrals", highlight: false },
                      { icon: DollarSign, label: "累计佣金", value: `$${totalComm.toFixed(0)}`,            sub: "USDT",             highlight: true  },
                      { icon: Award, label: "节点收益",      value: `${nrTotal.toFixed(0)} QA`,            sub: "token rewards",    highlight: false },
                    ].map((kpi, i) => (
                      <Kpi key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} sub={kpi.sub} highlight={kpi.highlight} delay={i * 0.05} />
                    ))}
                  </div>
                );
              })()}

              {/* ── Mini monthly trend (official RewardsTab MonthlyChart) ── */}
              {isConnected && (commission?.records?.length ?? 0) > 0 && (() => {
                const now = new Date();
                const bars = Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const label = `${d.getMonth() + 1}月`;
                  const amount = (commission?.records ?? []).reduce((s: number, r: any) => {
                    const rd = new Date(r.createdAt ?? "");
                    const rk = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}`;
                    return rk === key ? s + Number(r.amount ?? 0) : s;
                  }, 0);
                  return { label, amount };
                });
                const maxBar = Math.max(...bars.map(b => b.amount), 1);
                return (
                  <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-amber-900/20 via-slate-800/80 to-slate-800/90">
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
                    <CardHeader className="pb-2 border-b border-amber-500/15 relative z-10">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
                        月度佣金趋势
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 pb-3 relative z-10">
                      <div className="flex items-end gap-1.5 h-16">
                        {bars.map((b, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <div className="w-full flex items-end" style={{ height: 44 }}>
                              <motion.div
                                className="w-full rounded-t-md bg-gradient-to-t from-amber-600/80 to-amber-400/70"
                                initial={{ height: 0 }}
                                animate={{ height: maxBar > 0 ? `${Math.max(6, (b.amount / maxBar) * 40)}px` : "6px" }}
                                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                                style={{ maxHeight: 44 }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground/80">{b.label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* History filter pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
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
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${
                      historyFilter === f.key
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                        : "border-amber-500/22 bg-amber-950/15 text-amber-500/55 hover:border-amber-500/45 hover:text-amber-300/80"
                    }`}
                    onClick={() => setHistoryFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <Card className="surface-3d relative overflow-hidden bg-gradient-to-br from-slate-700/85 to-slate-700/90 border-amber-500/50">
                <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/15 via-transparent to-transparent blur-3xl pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent pointer-events-none" />
                <CardContent className="pt-4 pb-4 relative z-10">
                  {!isConnected ? (
                    <div className="py-10 text-center">
                      <WalletCards className="h-6 w-6 mx-auto mb-2 text-white/25" />
                      <p className="text-[13px] text-white/40">{t("profile.connectToViewCommission")}</p>
                    </div>
                  ) : historyFilter === "node_reward" ? (
                    nodeRewardsLoading ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
                    ) : !nodeRewards?.length ? (
                      <div className="py-12 text-center text-white/30 text-[13px]">{t("profile.noHistoryData")}</div>
                    ) : (
                      <div className="space-y-2">
                        {nodeRewards.map((rec: any) => {
                          const rType = rec.rewardType || rec.reward_type || "FIXED_YIELD";
                          const amount = Number(rec.amount || 0);
                          const isFixed = rType === "FIXED_YIELD";
                          const color = isFixed ? "#10b981" : "#f59e0b";
                          const bg = isFixed ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)";
                          const label = isFixed ? "节点固定收益" : "节点分红";
                          const dateStr = (rec.createdAt || rec.created_at)
                            ? new Date(rec.createdAt || rec.created_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "--";
                          return (
                            <div key={rec.id} className="rounded-xl p-3 flex items-center justify-between border border-amber-500/20 bg-amber-950/12">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                                  <ServerIcon className="h-4 w-4" style={{ color }} />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: bg, color }}>{label}</span>
                                  <div className="text-[9px] text-white/25 mt-0.5">{dateStr}</div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[13px] font-bold num" style={{ color }}>+{amount.toFixed(2)} QA</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : commissionLoading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
                  ) : !filteredRecords.length ? (
                    <div className="py-12 text-center text-white/30 text-[13px]">{t("profile.noHistoryData")}</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecords.map((record: any) => {
                        const rType = record.details?.type || "unknown";
                        const amount = Number(record.amount || 0);
                        const dateStr = record.createdAt
                          ? new Date(record.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "--";
                        const typeConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
                          direct_referral: { label: t("profile.directReward", "直推奖励"), color: "#ec4899", bg: "rgba(236,72,153,0.1)", icon: UserPlus },
                          differential:    { label: t("profile.teamDiff",    "团队级差"), color: "#6366f1", bg: "rgba(99,102,241,0.1)",   icon: Layers },
                          same_rank:       { label: t("profile.sameRank",    "同级奖励"), color: "#a855f7", bg: "rgba(168,85,247,0.1)",   icon: Users },
                          override:        { label: t("profile.override",    "越级奖励"), color: "#eab308", bg: "rgba(234,179,8,0.1)",    icon: Network },
                        };
                        const cfg = typeConfig[rType] || { label: rType, color: "#9ca3af", bg: "rgba(156,163,175,0.1)", icon: DollarSign };
                        const CfgIcon = cfg.icon;
                        return (
                          <div key={record.id} className="rounded-xl p-3 flex items-center justify-between border border-amber-500/20 bg-amber-950/12">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                                <CfgIcon className="h-4 w-4" style={{ color: cfg.color }} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                <div className="text-[9px] text-white/25 mt-0.5">{dateStr}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[13px] font-bold num" style={{ color: cfg.color }}>+{amount.toFixed(2)}</div>
                              <div className="text-[9px] text-white/25">USDT</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : mainTab === "chart" ? (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-4"
            >
              <ReferralCharts
                commission={commission}
                referrals={sbTeam?.referrals ?? []}
                directUsdt={directUsdt}
                teamUsdt={teamUsdt}
                isConnected={isConnected}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   图表 Tab — 推广中心数据可视化
══════════════════════════════════════════════════════════════════════════ */

const CHART_TOOLTIP_STYLE = {
  background: "rgba(8,6,2,0.95)",
  border: "1px solid rgba(251,191,36,0.3)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};
const CHART_LABEL_STYLE = { color: "#fbbf24", fontWeight: 600, marginBottom: 4 };

/* Reward-type colour map */
const REWARD_COLORS: Record<string, string> = {
  direct_referral: "#f59e0b",
  differential:    "#8b5cf6",
  same_rank:       "#ec4899",
  override:        "#10b981",
  unknown:         "#6b7280",
};
const REWARD_LABELS: Record<string, string> = {
  direct_referral: "直推佣金",
  differential:    "差额奖励",
  same_rank:       "平级奖励",
  override:        "越级奖励",
};

/* V-rank colours */
const RANK_COLORS: Record<string, string> = {
  V0: "#374151", V1: "#6b7280", V2: "#d97706", V3: "#f59e0b",
  V4: "#fbbf24", V5: "#fcd34d", V6: "#fb923c",
  V7: "#f97316", V8: "#ef4444", V9: "#dc2626",
};

function ReferralCharts({
  commission, referrals, directUsdt, teamUsdt, isConnected,
}: {
  commission: CommissionSummary | undefined;
  referrals: any[];
  directUsdt: number;
  teamUsdt: number;
  isConnected: boolean;
}) {
  /* ── 1. Monthly commission trend ── */
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; key: string; amount: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ key, label: `${d.getMonth() + 1}月`, amount: 0, count: 0 });
    }
    const byKey = new Map(buckets.map(b => [b.key, b]));
    for (const r of commission?.records ?? []) {
      const d = new Date(r.createdAt ?? "");
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = byKey.get(key);
      if (!b) continue;
      b.amount += Number(r.amount ?? 0);
      b.count  += 1;
    }
    return buckets;
  }, [commission]);

  /* ── 2. Reward-type pie ── */
  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of commission?.records ?? []) {
      const k = r.details?.type ?? "unknown";
      totals[k] = (totals[k] ?? 0) + Number(r.amount ?? 0);
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(4)),
        label: REWARD_LABELS[name] ?? name,
        color: REWARD_COLORS[name] ?? "#6b7280",
      }));
  }, [commission]);

  /* ── 3. Team V-rank distribution ── */
  const rankData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of referrals) {
      const r = m.rank || "V0";
      counts[r] = (counts[r] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rank, count]) => ({ rank, count, fill: RANK_COLORS[rank] ?? "#6b7280" }));
  }, [referrals]);

  /* ── 4. Business performance bar ── */
  const perfData = [
    { name: "直推业绩", value: directUsdt, fill: "#f59e0b" },
    { name: "团队业绩", value: teamUsdt,   fill: "#fcd34d" },
  ];

  const hasAny = (commission?.records?.length ?? 0) > 0 || referrals.length > 0;

  if (!isConnected) {
    return (
      <div className="rounded-2xl p-10 text-center border border-amber-500/15 bg-amber-500/[0.03]">
        <BarChart2 className="h-10 w-10 text-amber-400/30 mx-auto mb-3" />
        <p className="text-sm text-white/40">连接钱包查看图表</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 月度佣金趋势 ── */}
      <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-amber-900/20 via-slate-800/80 to-slate-800/90">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
        <CardHeader className="pb-3 border-b border-amber-500/15 relative z-10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
            月度佣金趋势
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 relative z-10">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="refBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#fbbf24" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.12} />
                  </linearGradient>
                  <filter id="refLineGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 5" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} dy={4} />
                <YAxis yAxisId="left"  stroke="rgba(251,191,36,0.5)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(167,243,208,0.5)" fontSize={10} tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_LABEL_STYLE}
                  formatter={(value: number, name: string) =>
                    name === "count" ? [value, "笔数"] : [`$${value.toLocaleString()}`, "金额 USDT"]
                  }
                />
                <Bar yAxisId="left"  dataKey="count"  fill="url(#refBarGrad)" radius={[5, 5, 0, 0]} animationDuration={600} />
                <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#86efac" strokeWidth={2}
                  dot={{ r: 3, fill: "#86efac", stroke: "#050505", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: "#86efac" }}
                  filter="url(#refLineGlow)" animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── 下排两图并排 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 奖励类型分布 pie */}
        <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-slate-700/85 to-slate-800/90">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent pointer-events-none" />
          <CardHeader className="pb-3 border-b border-amber-500/15 relative z-10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              奖励类型分布
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 relative z-10">
            {pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-white/25 text-xs">暂无佣金数据</div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%"
                      innerRadius="45%" outerRadius="72%" paddingAngle={3} animationDuration={700}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_LABEL_STYLE}
                      formatter={(v: number, _: string, p: any) =>
                        [`$${v.toLocaleString()}`, p.payload?.label ?? ""]
                      }
                    />
                    <Legend
                      iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                      formatter={(value: string, entry: any) => (
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>
                          {entry.payload?.label ?? value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 团队等级分布 bar */}
        <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-slate-700/85 to-slate-800/90">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent pointer-events-none" />
          <CardHeader className="pb-3 border-b border-amber-500/15 relative z-10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" />
              团队等级分布
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 relative z-10">
            {rankData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-white/25 text-xs">暂无团队数据</div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rankData} layout="vertical" margin={{ top: 0, right: 24, left: 28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(255,255,255,0.35)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="rank" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} width={24} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_LABEL_STYLE}
                      formatter={(v: number) => [v, "人数"]}
                    />
                    <Bar dataKey="count" radius={[0, 5, 5, 0]} animationDuration={700}>
                      {rankData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 业绩对比 ── */}
      <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-slate-700/85 to-slate-800/90">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent pointer-events-none" />
        <CardHeader className="pb-3 border-b border-amber-500/15 relative z-10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-400" />
            直推 vs 团队业绩 (USDT)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 relative z-10">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={perfData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(251,191,36,0.45)" fontSize={10} tickLine={false} axisLine={false} width={40}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_LABEL_STYLE}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "USDT"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={700}>
                  {perfData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-white/30 text-center">数据基于链上已索引记录，更新约延迟 5 分钟</p>
    </div>
  );
}
