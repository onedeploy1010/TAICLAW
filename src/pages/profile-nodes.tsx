import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import { ArrowLeft, ArrowUpRight, WalletCards, Zap, ShieldCheck, ChevronRight, TrendingUp, Lock, Unlock, Award, ExternalLink, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { getNodeOverview, getNodeEarningsRecords, getNodeMemberships, getNodeMilestoneRequirements, getProfile, apiPost } from "@/lib/api";
import type { NodeOverview, NodeEarningsRecord, NodeMembership } from "@shared/types";
import { NODE_PLANS, NODE_MILESTONES, NODE_ACTIVATION_TIERS, NODE_QUALIFICATION_CHECKS } from "@/lib/data";
import { useTranslation } from "react-i18next";
import { useMaPrice } from "@/hooks/use-ma-price";
import { useToast } from "@/hooks/use-toast";
import { NodePurchaseDialog } from "@/components/nodes/node-purchase-section";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type TabKey = "purchase" | "earnings";

// Node system not yet activated — show original deadline days (no countdown)
function getMilestoneDaysLeft(_startDate: string | null, deadlineDays: number): number {
  return deadlineDays;
}

export default function ProfileNodesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";
  const isConnected = !!walletAddr;
  const [activeTab, setActiveTab] = useState<TabKey>("purchase");
  const { formatMA, formatCompactMA } = useMaPrice();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseNodeType, setPurchaseNodeType] = useState<"MAX" | "MINI">("MAX");

  const [nodeInfoOpen, setNodeInfoOpen] = useState(false);

  const handleMaxNodeClick = () => {
    setPurchaseNodeType("MAX");
    setPurchaseDialogOpen(true);
  };

  // V6: read nodes directly from DB (getNodeOverview RPC returns stale data)
  const { data: directNodes = [] } = useQuery({
    queryKey: ["node-memberships-direct", walletAddr],
    queryFn: () => getNodeMemberships(walletAddr),
    enabled: isConnected,
  });

  const { data: overview, isLoading } = useQuery<NodeOverview>({
    queryKey: ["node-overview", walletAddr],
    queryFn: () => getNodeOverview(walletAddr),
    enabled: isConnected,
  });

  const { data: earningsRecords = [] } = useQuery<NodeEarningsRecord[]>({
    queryKey: ["node-earnings", walletAddr],
    queryFn: () => getNodeEarningsRecords(walletAddr),
    enabled: isConnected,
  });

  const { data: allMemberships = [] } = useQuery<NodeMembership[]>({
    queryKey: ["node-memberships", walletAddr],
    queryFn: () => getNodeMemberships(walletAddr),
    enabled: isConnected,
  });

  const { data: requirements } = useQuery<{
    vaultDeposited: number; directNodeReferrals: number; directMiniReferrals: number;
    activatedRank: string | null; earningsPaused: boolean;
  }>({
    queryKey: ["node-milestone-requirements", walletAddr],
    queryFn: () => getNodeMilestoneRequirements(walletAddr),
    enabled: isConnected,
  });

  const vaultDeposited = requirements?.vaultDeposited ?? 0;
  const directNodeReferrals = requirements?.directNodeReferrals ?? 0;
  const directMiniReferrals = requirements?.directMiniReferrals ?? 0;
  const isEarningsPaused = requirements?.earningsPaused ?? false;

  // Use direct DB nodes if overview RPC returns empty (V6 RPC is stale)
  const nodes = (overview?.nodes && overview.nodes.length > 0) ? overview.nodes : directNodes;
  const activeNodes = nodes.filter((n: any) => n.status === "ACTIVE" || n.status === "PENDING_MILESTONES");

  // Check node_type from profile (reliable, doesn't depend on overview RPC)
  const { data: profileData } = useQuery({
    queryKey: ["profile-node-check", walletAddr],
    queryFn: () => getProfile(walletAddr),
    enabled: isConnected,
  });
  const profileNodeType = profileData?.nodeType || profileData?.node_type || "NONE";
  const hasAnyNode = profileNodeType !== "NONE" || activeNodes.length > 0;
  const hasMAX = hasAnyNode;
  const hasMINI = hasAnyNode;
  const activeCount = activeNodes.length;
  const totalEarnings = Number(overview?.rewards?.totalEarnings || 0);
  const releasedEarnings = Number(overview?.releasedEarnings || overview?.rewards?.fixedYield || 0);
  const availableBalance = Number(overview?.availableBalance || 0);
  const lockedEarnings = Number(overview?.lockedEarnings || 0);

  const firstNode = activeNodes.length > 0 ? activeNodes[0] : null;
  const activatedRank = requirements?.activatedRank ?? firstNode?.activatedRank ?? null;
  const daysActive = firstNode?.startDate
    ? Math.floor((Date.now() - new Date(firstNode.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const nodeType = (firstNode?.nodeType || "MINI") as keyof typeof NODE_PLANS;
  const nodeFrozenTotal = firstNode ? (NODE_PLANS[nodeType]?.frozenAmount || 0) : 0;
  const totalDays = firstNode ? (NODE_PLANS[nodeType]?.durationDays || 0) : 0;
  const milestones = NODE_MILESTONES[nodeType] || [];

  const currentRank = overview?.rank || "V0";

  const destroyedEarnings = Number(overview?.destroyedEarnings || 0);
  const releaseStatus = activatedRank
    ? (isEarningsPaused ? t("profile.earningsPaused") : t("profile.activatedLabel") + " " + activatedRank)
    : t("profile.notActivated");

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: t("profile.statusActive"),
      PENDING_MILESTONES: t("profile.statusPendingMilestones"),
      CANCELLED: t("profile.statusCancelled"),
      EXPIRED: t("profile.statusExpired"),
    };
    return map[status] || status;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "--";
    return new Date(d).toLocaleDateString();
  };

  const getMilestoneDesc = (ms: { rank: string; desc: string; requiredHolding: number; requiredReferrals: number }) => {
    if (ms.requiredReferrals > 0)
      return t("profile.rankDescHoldingRefs", { amount: ms.requiredHolding, refs: ms.requiredReferrals });
    if (ms.requiredHolding > 0)
      return t("profile.vaultDepositRequired", { amount: ms.requiredHolding });
    return ms.desc;
  };

  // Get activation tiers for current node type
  const activationTiers = nodeType === "MAX" ? NODE_ACTIVATION_TIERS.MAX : NODE_ACTIVATION_TIERS.MINI;
  const qualificationChecks = nodeType === "MAX" ? NODE_QUALIFICATION_CHECKS.MAX : NODE_QUALIFICATION_CHECKS.MINI;

  // Determine which tier the user currently qualifies for
  const currentActivationTier = activationTiers.filter(tier => {
    const meetsDeposit = vaultDeposited >= tier.vaultDeposit;
    const meetsRefs = tier.requiredMiniReferrals === 0 || directMiniReferrals >= tier.requiredMiniReferrals;
    return meetsDeposit && meetsRefs;
  }).pop();

  // ─── Activation state derivations ───
  const isActivated = activatedRank != null && activatedRank !== "V0";
  // Conditions met but backend hasn't activated yet — show "立即激活" button
  const meetsActivationButPending = !isActivated && currentActivationTier != null;

  // For MINI nodes, the daily yield is locked until V2 day-30 milestone passes.
  // After that (or if it's a MAX node), yield is unlocked and claimable.
  const miniV2Achieved = firstNode?.milestones?.some(
    (m: any) => m.requiredRank === "V2" && m.status === "ACHIEVED"
  ) ?? false;
  const yieldUnlocked = nodeType === "MAX" || miniV2Achieved;
  const yieldStatusKey = yieldUnlocked ? "profile.unlockedTag" : "profile.lockedTag";
  const yieldStatusFallback = yieldUnlocked ? "解锁" : "锁仓";

  const milestoneStates = milestones.map((ms, idx) => {
    const daysLeft = getMilestoneDaysLeft(firstNode?.startDate ?? null, ms.days);
    const dbMilestone = firstNode?.milestones?.find((m: any) => m.requiredRank === ms.rank) ?? firstNode?.milestones?.[idx];
    const isAchieved = dbMilestone?.status === "ACHIEVED";
    const isFailed = dbMilestone?.status === "FAILED";
    const isExpired = !isAchieved && ms.days > 0 && daysLeft === 0;
    const prevMs = idx > 0 ? milestones[idx - 1] : null;
    const prevDbMilestone = prevMs ? (firstNode?.milestones?.find((m: any) => m.requiredRank === prevMs.rank) ?? firstNode?.milestones?.[idx - 1]) : null;
    const isCurrent = !isAchieved && !isFailed && !isExpired && (idx === 0 || prevDbMilestone?.status === "ACHIEVED");
    const holdingOk = nodeType === "MAX" ? vaultDeposited >= ms.requiredHolding : true;
    const referralsOk = ms.requiredReferrals === 0 || directNodeReferrals >= ms.requiredReferrals;
    const requirementsMet = holdingOk && referralsOk;
    const hasRequirements = ms.requiredHolding > 0 || ms.requiredReferrals > 0;
    return { ...ms, daysLeft, isAchieved, isFailed, isExpired, isCurrent, holdingOk, referralsOk, requirementsMet, hasRequirements };
  });

  const achievedCount = milestoneStates.filter(m => m.isAchieved).length;
  const currentMilestone = milestoneStates.find(m => m.isCurrent);
  const overallProgress = milestones.length > 0
    ? (achievedCount / milestones.length) * 100
    : 0;

  // ─── Current stage countdown (e.g. day 5 of stage 1-15) ───
  // For each milestone, the "stage" is the days between the previous milestone day and this one.
  // E.g. MAX V1 stage = day 0-15, V2 stage = day 15-30, V4 stage = day 30-60, V6 stage = day 60-120.
  const currentMilestoneIdx = milestoneStates.findIndex(m => m.isCurrent);
  const stageStartDay = currentMilestoneIdx > 0 ? (milestones[currentMilestoneIdx - 1]?.days ?? 0) : 0;
  const stageEndDay = currentMilestone?.days ?? 0;
  const stageTotalDays = Math.max(1, stageEndDay - stageStartDay);
  const dayInStage = Math.max(0, Math.min(stageTotalDays, daysActive - stageStartDay));

  const progressPercent = totalDays > 0 ? Math.min(Math.max((daysActive / totalDays) * 100, 1), 100) : 0;

  // Tiffany + Green palette
  const tiffany = "#0abab5";
  const tiffanyLight = "#81d8d0";
  const accentGreen = "#34d399";

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pt-4" style={{ background: "#080b0e" }} data-testid="page-profile-nodes">
      {/* Header with Tiffany-Green gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0a1f1e 0%, #0c1a18 30%, #080b0e 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% -10%, rgba(10,186,181,0.35) 0%, transparent 55%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 75% 0%, rgba(52,211,153,0.2) 0%, transparent 50%)" }} />
        <div className="absolute top-0 left-0 w-full h-full opacity-15" style={{ background: "radial-gradient(circle at 50% 40%, rgba(129,216,208,0.3), transparent 60%)" }} />

        <div className="relative px-4 sm:px-6 pt-3 pb-6">
          <div className="flex items-center justify-center relative mb-5 lg:justify-start">
            <button
              onClick={() => navigate("/profile")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors lg:hidden"
              style={{ background: "rgba(10,186,181,0.1)", border: "1px solid rgba(10,186,181,0.25)" }}
            >
              <ArrowLeft className="h-5 w-5 text-white/90" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white">{t("profile.nodeDetailsTitle")}</h1>
            <button
              onClick={() => setNodeInfoOpen(true)}
              className="absolute right-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "rgba(10,186,181,0.1)", border: "1px solid rgba(10,186,181,0.25)" }}
            >
              <Info className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {/* Main progress card */}
          <div
            className="rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(145deg, rgba(10,186,181,0.1), rgba(52,211,153,0.05), rgba(16,16,20,0.95))",
              border: "1px solid rgba(10,186,181,0.2)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="absolute top-0 right-0 w-28 h-28 opacity-20" style={{ background: "radial-gradient(circle, rgba(10,186,181,0.5), transparent 70%)", filter: "blur(20px)" }} />
            <div className="absolute bottom-0 left-0 w-20 h-20 opacity-15" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.4), transparent 70%)", filter: "blur(15px)" }} />

            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-white">{t("profile.myNodesLabel")}</span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(10,186,181,0.15)", color: tiffanyLight, border: `1px solid rgba(10,186,181,0.3)` }}
                >
                  {activeCount} {t("common.active")}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-black text-white">{daysActive}<span className="text-xs text-white/40 font-medium">/{totalDays || 0}</span></div>
                <div className="text-[11px] sm:text-xs text-white/35">{t("profile.dayUnit")}</div>
              </div>
            </div>

            {/* Target rank display */}
            {hasAnyNode && (
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs text-white/35">{t("profile.currentRankLabel", "当前等级")}</span>
                  <span className="text-sm sm:text-base font-black" style={{ color: tiffanyLight }}>{currentRank}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs text-white/35">{t("profile.targetRankLabel", "目标等级")}</span>
                  <span
                    className="text-sm sm:text-base font-black px-2.5 py-0.5 rounded-lg"
                    style={{
                      background: "linear-gradient(135deg, rgba(10,186,181,0.2), rgba(52,211,153,0.15))",
                      border: "1px solid rgba(10,186,181,0.3)",
                      color: accentGreen,
                    }}
                  >
                    {nodeType === "MAX" ? "V6" : "V4"}
                  </span>
                </div>
              </div>
            )}

            {/* Progress bar with tiffany-green gradient */}
            <div className="relative mb-1">
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                  style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, ${tiffany}, ${accentGreen}, #a3e635)`,
                    boxShadow: `0 0 12px rgba(10,186,181,0.4)`,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                      animation: "shimmer 2s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Pre-activation, conditions met: ONE collapsed line + activate button */}
            {activeNodes.length > 0 && meetsActivationButPending && (
              <div className="mt-3 space-y-2">
                <div
                  className="rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, rgba(52,211,153,0.1), rgba(10,186,181,0.05))`,
                    border: `1px solid ${accentGreen}40`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${tiffany}, ${accentGreen})` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold flex-1" style={{ color: accentGreen }}>
                    {t("profile.conditionsMetPending", "条件已达成 {{rank}},等待激活", { rank: currentActivationTier?.rank })}
                  </span>
                  <button
                    className="text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${tiffany}, ${accentGreen})`,
                      color: "#000",
                    }}
                    onClick={async () => {
                      try {
                        await apiPost("/api/check-node-milestones", { walletAddress: walletAddr });
                        toast({ title: t("profile.activationTriggered", "激活检查已触发,刷新中...") });
                        queryClient.invalidateQueries({ queryKey: ["node-milestone-requirements", walletAddr] });
                        queryClient.invalidateQueries({ queryKey: ["node-overview", walletAddr] });
                        queryClient.invalidateQueries({ queryKey: ["node-memberships", walletAddr] });
                      } catch (e: any) {
                        toast({ title: t("profile.activationFailed", "激活失败"), description: e.message, variant: "destructive" });
                      }
                    }}
                  >
                    {t("profile.activateNow", "立即激活")}
                  </button>
                </div>
              </div>
            )}

            {/* Pre-activation, conditions NOT met: full tier checklist */}
            {activeNodes.length > 0 && !isActivated && !meetsActivationButPending && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-bold text-yellow-400 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  {t("profile.activateNodeFirst", "激活节点开启收益")}
                </div>
                <div className="text-[10px] text-white/40 mb-1">
                  {t("profile.currentDeposit", "当前金库存入 ${{amount}}", { amount: vaultDeposited.toFixed(0) })}
                </div>
                <div className="space-y-1">
                  {activationTiers.map((tier) => {
                    const meetsDeposit = vaultDeposited >= tier.vaultDeposit;
                    const meetsRefs = tier.requiredMiniReferrals === 0 || directMiniReferrals >= tier.requiredMiniReferrals;
                    const met = meetsDeposit && meetsRefs;
                    return (
                      <div
                        key={tier.rank}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                        style={{
                          background: met ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${met ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: met
                              ? `linear-gradient(135deg, ${tiffany}, ${accentGreen})`
                              : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {met && (
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span
                          className="text-[11px] font-bold shrink-0"
                          style={{ color: met ? accentGreen : "rgba(255,255,255,0.4)" }}
                        >
                          {tier.rank}
                        </span>
                        <span className="text-[10px] text-white/50 truncate">
                          {t("profile.reachActivation", "达到 {{rank}}: 金库存入 ${{deposit}}", {
                            rank: tier.rank,
                            deposit: tier.vaultDeposit,
                          })}
                          {tier.requiredMiniReferrals > 0 && (
                            <> {t("profile.plusReferrals", "+ 推荐 {{count}} 个小节点", { count: tier.requiredMiniReferrals })}</>
                          )}
                        </span>
                        <span
                          className="ml-auto text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded"
                          style={{
                            color: met ? accentGreen : "#fbbf24",
                            background: met ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.1)",
                          }}
                        >
                          {met ? t("profile.tierMet", "已达成") : t("profile.tierNotMet", "未达成")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Post-activation: show milestone progress dots */}
            {activeNodes.length > 0 && isActivated && milestones.length > 0 && (
              <div className="mt-3">
                <div className="flex justify-between items-end px-0.5">
                  {milestoneStates.map((ms, idx) => (
                    <div key={ms.rank} className="flex flex-col items-center" style={{ width: `${100 / milestones.length}%` }}>
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center relative"
                        style={{
                          background: ms.isAchieved
                            ? `linear-gradient(135deg, ${tiffany}, ${accentGreen})`
                            : ms.isCurrent
                            ? "linear-gradient(135deg, #facc15, #eab308)"
                            : ms.isFailed || ms.isExpired
                            ? "linear-gradient(135deg, #ef4444, #dc2626)"
                            : "rgba(255,255,255,0.08)",
                          boxShadow: ms.isCurrent
                            ? "0 0 12px rgba(250,204,21,0.5)"
                            : ms.isAchieved
                            ? `0 0 8px rgba(10,186,181,0.4)`
                            : "none",
                        }}
                      >
                        {ms.isAchieved && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                        {ms.isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                        {(ms.isFailed || ms.isExpired) && (
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        )}
                      </div>
                      <span className={`text-[11px] sm:text-xs mt-1 font-bold`} style={{
                        color: ms.isAchieved ? tiffanyLight :
                        ms.isCurrent ? "#fde047" :
                        ms.isFailed || ms.isExpired ? "#f87171" :
                        "rgba(255,255,255,0.25)"
                      }}>
                        {ms.rank}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Compact "已激活 VX" line + current stage countdown + check status */}
                <div className="mt-3 space-y-1.5">
                  {/* Activated rank line */}
                  <div
                    className="rounded-lg px-3 py-1.5 flex items-center gap-2"
                    style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tiffany}, ${accentGreen})` }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold flex-1" style={{ color: accentGreen }}>
                      {t("profile.activatedAt", "激活已达成 {{rank}}", { rank: activatedRank })}
                    </span>
                  </div>

                  {/* Current stage check status with stage countdown */}
                  {currentMilestone && (
                    <div
                      className="rounded-lg px-3 py-1.5 flex items-center gap-2"
                      style={{
                        background: currentMilestone.requirementsMet
                          ? "rgba(52,211,153,0.06)"
                          : "rgba(250,204,21,0.06)",
                        border: `1px solid ${currentMilestone.requirementsMet ? "rgba(52,211,153,0.18)" : "rgba(250,204,21,0.15)"}`,
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                        style={{
                          background: currentMilestone.requirementsMet ? accentGreen : "#facc15",
                          boxShadow: currentMilestone.requirementsMet
                            ? `0 0 6px ${accentGreen}80`
                            : "0 0 6px rgba(250,204,21,0.5)",
                        }}
                      />
                      <span
                        className="text-[11px] font-medium flex-1 truncate"
                        style={{ color: currentMilestone.requirementsMet ? accentGreen : "rgba(255,255,255,0.7)" }}
                      >
                        {t("profile.checkStage", "考核 {{rank}}", { rank: currentMilestone.rank })}
                        {" · "}
                        {currentMilestone.requirementsMet
                          ? t("profile.tierMet", "已达成")
                          : t("profile.tierNotMet", "未达成")}
                      </span>
                      {/* Stage countdown like 5/15 */}
                      <span className="text-[11px] font-mono font-bold shrink-0 text-white/80">
                        {dayInStage}/{stageTotalDays}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isConnected ? (
        <div className="px-4 sm:px-6 mt-4">
          <div className="rounded-2xl p-8 text-center" style={{ background: "#12161a", border: "1px solid rgba(10,186,181,0.15)" }}>
            <WalletCards className="h-10 w-10 text-white/30 mx-auto mb-3" />
            <p className="text-base text-white/50">{t("profile.connectToViewNodes")}</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="px-4 sm:px-6 mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="px-4 sm:px-6 -mt-1 space-y-3">
          {/* Purchase buttons — bright, distinct from data cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* MAX node — vivid teal/cyan */}
            <button
              className="node-btn-max rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all duration-150 relative overflow-hidden group"
              style={{
                background: hasMAX
                  ? "linear-gradient(160deg, #1a2a2a 0%, #162222 40%, #141a1a 100%)"
                  : "linear-gradient(160deg, #0d9488 0%, #0f766e 40%, #115e59 100%)",
                border: hasMAX ? "2px solid rgba(255,255,255,0.15)" : "2px solid rgba(255,255,255,0.5)",
                boxShadow: hasMAX
                  ? "none"
                  : "0 6px 0 #0a4f4a, 0 8px 20px rgba(13,148,136,0.4), 0 0 30px rgba(20,184,166,0.2), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)",
                opacity: hasMAX ? 0.85 : 1,
              }}
              onClick={() => {
                if (hasMAX) {
                  toast({ title: t("profile.alreadyPurchased"), description: t("profile.alreadyPurchasedDesc") });
                } else {
                  handleMaxNodeClick();
                }
              }}
            >
              {!hasMAX && <div className="node-btn-glow absolute -top-6 -right-6 w-32 h-32" style={{ background: "radial-gradient(circle, rgba(94,234,212,0.5), transparent 60%)", filter: "blur(20px)" }} />}
              {!hasMAX && <div className="absolute bottom-0 left-0 w-24 h-24 opacity-30" style={{ background: "radial-gradient(circle, rgba(45,212,191,0.5), transparent 60%)", filter: "blur(16px)" }} />}
              {!hasMAX && <div className="absolute top-0 left-[5%] right-[5%] h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }} />}

              <div className="relative z-[2] flex items-center gap-3">
                <div className="node-btn-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{
                  background: hasMAX ? "rgba(45,212,191,0.15)" : "linear-gradient(145deg, #2dd4bf, #14b8a6)",
                  boxShadow: hasMAX ? "none" : "0 3px 12px rgba(45,212,191,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
                }}>
                  <Zap className="h-5 w-5" style={{ color: hasMAX ? "rgba(45,212,191,0.5)" : "white", filter: hasMAX ? "none" : "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[14px] sm:text-[15px] font-extrabold tracking-tight" style={{ color: hasMAX ? "rgba(255,255,255,0.5)" : "white", textShadow: hasMAX ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }}>{t("profile.applyLargeNode")}</div>
                  <div className="text-[15px] font-black mt-0.5" style={{ color: hasMAX ? "rgba(255,255,255,0.35)" : "white" }}>${NODE_PLANS.MAX.price} <span className="text-[11px] font-semibold" style={{ color: hasMAX ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)" }}>USDT</span></div>
                </div>
              </div>

              <div className="relative z-[2] flex items-center justify-between w-full">
                <span className="text-[10px] font-medium" style={{ color: hasMAX ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)" }}>{t("profile.nodeTotal")} ${NODE_PLANS.MAX.frozenAmount.toLocaleString()}</span>
                {hasMAX ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.2)", color: "rgba(45,212,191,0.6)" }}>
                    {t("profile.alreadyPurchased")}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 group-active:scale-90" style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}>
                    <span className="text-[10px] font-extrabold tracking-wider text-white">GO</span>
                    <ArrowUpRight className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            </button>

            {/* MINI node — vivid indigo/purple */}
            <button
              className="node-btn-mini rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all duration-150 relative overflow-hidden group"
              style={{
                background: hasMINI
                  ? "linear-gradient(160deg, #1a1a2a 0%, #161622 40%, #14141a 100%)"
                  : "linear-gradient(160deg, #6366f1 0%, #4f46e5 40%, #4338ca 100%)",
                border: hasMINI ? "2px solid rgba(255,255,255,0.15)" : "2px solid rgba(255,255,255,0.4)",
                boxShadow: hasMINI
                  ? "none"
                  : "0 6px 0 #3730a3, 0 8px 20px rgba(99,102,241,0.35), 0 0 25px rgba(129,140,248,0.15), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)",
                opacity: hasMINI ? 0.85 : 1,
              }}
              onClick={() => {
                if (hasMINI) {
                  toast({ title: t("profile.alreadyPurchased"), description: t("profile.alreadyPurchasedDesc") });
                } else {
                  setPurchaseNodeType("MINI"); setPurchaseDialogOpen(true);
                }
              }}
            >
              {!hasMINI && <div className="node-btn-glow absolute -top-6 -right-6 w-28 h-28" style={{ background: "radial-gradient(circle, rgba(165,180,252,0.5), transparent 60%)", filter: "blur(18px)" }} />}
              {!hasMINI && <div className="absolute bottom-0 left-0 w-20 h-20 opacity-25" style={{ background: "radial-gradient(circle, rgba(129,140,248,0.5), transparent 60%)", filter: "blur(14px)" }} />}
              {!hasMINI && <div className="absolute top-0 left-[5%] right-[5%] h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }} />}

              <div className="relative z-[2] flex items-center gap-3">
                <div className="node-btn-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{
                  background: hasMINI ? "rgba(129,140,248,0.15)" : "linear-gradient(145deg, #a5b4fc, #818cf8)",
                  boxShadow: hasMINI ? "none" : "0 3px 12px rgba(129,140,248,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
                }}>
                  <ShieldCheck className="h-5 w-5" style={{ color: hasMINI ? "rgba(129,140,248,0.5)" : "white", filter: hasMINI ? "none" : "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[14px] sm:text-[15px] font-extrabold tracking-tight" style={{ color: hasMINI ? "rgba(255,255,255,0.5)" : "white", textShadow: hasMINI ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }}>{t("profile.applySmallNode")}</div>
                  <div className="text-[15px] font-black mt-0.5" style={{ color: hasMINI ? "rgba(255,255,255,0.35)" : "white" }}>${NODE_PLANS.MINI.price} <span className="text-[11px] font-semibold" style={{ color: hasMINI ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)" }}>USDT</span></div>
                </div>
              </div>

              <div className="relative z-[2] flex items-center justify-between w-full">
                <span className="text-[10px] font-medium" style={{ color: hasMINI ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)" }}>{t("profile.nodeTotal")} ${NODE_PLANS.MINI.frozenAmount.toLocaleString()}</span>
                {hasMINI ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", color: "rgba(129,140,248,0.6)" }}>
                    {t("profile.alreadyPurchased")}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 group-active:scale-90" style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}>
                    <span className="text-[10px] font-extrabold tracking-wider text-white">GO</span>
                    <ArrowUpRight className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Stats grid — 4 individual cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #101820, #0e1216)", border: "1px solid rgba(10,186,181,0.12)" }}>
              <div className="absolute top-0 right-0 w-20 h-20 opacity-10" style={{ background: `radial-gradient(circle, ${tiffany}, transparent 70%)`, filter: "blur(10px)" }} />
              <div className="flex items-center gap-1.5 mb-2.5">
                <TrendingUp className="h-4 w-4" style={{ color: tiffanyLight }} />
                <span className="text-[11px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">{t("profile.nodeTotalAmount")}</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">${nodeFrozenTotal.toLocaleString()}</div>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0e1a18, #0e1216)", border: `1px solid rgba(52,211,153,0.12)` }}>
              <div className="absolute top-0 right-0 w-20 h-20 opacity-10" style={{ background: `radial-gradient(circle, ${accentGreen}, transparent 70%)`, filter: "blur(10px)" }} />
              <div className="flex items-center gap-1.5 mb-2.5">
                <Unlock className="h-4 w-4" style={{ color: accentGreen }} />
                <span className="text-[11px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">{t("profile.releasedEarnings")}</span>
              </div>
              <div className="text-xl sm:text-2xl font-black" style={{ color: accentGreen }}>{formatCompactMA(releasedEarnings)}</div>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #14161c, #0e1216)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Award className="h-4 w-4" style={{ color: "#c4b5fd" }} />
                <span className="text-[11px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">{t("profile.releaseStatus")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{
                  background: activatedRank
                    ? (isEarningsPaused ? "#f59e0b" : accentGreen)
                    : "rgba(255,255,255,0.2)",
                }} />
                <span className="text-base sm:text-lg font-bold" style={{
                  color: activatedRank
                    ? (isEarningsPaused ? "#f59e0b" : accentGreen)
                    : "rgba(255,255,255,0.6)",
                }}>{releaseStatus}</span>
              </div>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #161418, #0e1216)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <TrendingUp className="h-4 w-4" style={{ color: tiffanyLight }} />
                <span className="text-[11px] sm:text-xs text-white/40 font-medium uppercase tracking-wider">{t("profile.unlockedEarnings", "解锁收益")}</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white">{formatCompactMA(releasedEarnings)}</div>
            </div>

            {lockedEarnings > 0 && (
              <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #1a1614, #0e1216)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Lock className="h-4 w-4 text-amber-400/70" />
                  <span className="text-[11px] sm:text-xs text-amber-400/50 font-medium uppercase tracking-wider">{t("profile.lockedEarnings", "锁仓收益")}</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-amber-400/80">{formatCompactMA(lockedEarnings)}</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ background: "#0e1216", border: "1px solid rgba(10,186,181,0.1)" }}
          >
            {([
              { key: "purchase" as TabKey, label: t("profile.purchaseRecords") },
              { key: "earnings" as TabKey, label: t("profile.earningsDetailTab") },
            ]).map((tab) => (
              <button
                key={tab.key}
                className="flex-1 py-3 text-xs sm:text-sm font-bold transition-all text-center relative"
                style={{
                  color: activeTab === tab.key ? tiffanyLight : "rgba(255,255,255,0.4)",
                  background: activeTab === tab.key ? "rgba(10,186,181,0.08)" : "transparent",
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${tiffany}, ${accentGreen})` }} />
                )}
              </button>
            ))}
          </div>

          {/* Purchase tab */}
          {activeTab === "purchase" && (
            <div className="space-y-2">
              {allMemberships.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">
                  {t("profile.noData")}
                </div>
              ) : (
                allMemberships.map((m: any) => {
                  // Use top-level activatedRank (from requirements RPC) as fallback —
                  // this is the same source the main progress card uses, so the
                  // membership card stays in sync even if m.activatedRank on the
                  // membership row hasn't been written by check_node_activation yet.
                  const memberActivatedRank = m.activatedRank || activatedRank;
                  // Daily yield: leveraged amount × 0.9% (e.g. MAX: 6000×0.009=54)
                  const dailyYieldUsd = m.nodeType === "MAX" ? 54 : 9;
                  return (
                  <div
                    key={m.id}
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: "#0e1216", border: `1px solid ${m.nodeType === "MAX" ? "rgba(10,186,181,0.12)" : "rgba(129,140,248,0.12)"}` }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
                          background: m.nodeType === "MAX"
                            ? "linear-gradient(135deg, rgba(10,186,181,0.2), rgba(10,186,181,0.08))"
                            : "linear-gradient(135deg, rgba(129,140,248,0.2), rgba(129,140,248,0.08))",
                        }}>
                          {m.nodeType === "MAX" ? <Zap className="h-4 w-4" style={{ color: tiffanyLight }} /> : <ShieldCheck className="h-4 w-4" style={{ color: "#a5b4fc" }} />}
                        </div>
                        <div>
                          <span className="text-[14px] font-bold text-white">
                            {m.nodeType === "MAX" ? t("profile.applyLargeNode") : t("profile.applySmallNode")}
                          </span>
                          <div className="text-[11px] text-white/30 mt-0.5">{formatDate(m.startDate)}</div>
                        </div>
                      </div>
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{
                        color: memberActivatedRank ? accentGreen : "#fbbf24",
                        background: memberActivatedRank ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
                        border: `1px solid ${memberActivatedRank ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
                      }}>
                        {memberActivatedRank ? `${t("profile.activatedLabel")} ${memberActivatedRank}` : t("profile.vaultNotActive")}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="text-[10px] text-white/30 mb-0.5">{t("profile.contribution")}</div>
                        <div className="text-[13px] font-bold text-white">{m.nodeType === "MAX" ? "600" : "100"} USDT</div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="text-[10px] text-white/30 mb-0.5">{t("profile.nodeTotal")}</div>
                        <div className="text-[13px] font-bold text-white">${(m.nodeType === "MAX" ? NODE_PLANS.MAX.frozenAmount : NODE_PLANS.MINI.frozenAmount).toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="text-[10px] text-white/30 mb-0.5">{t("profile.dailyYield", "每日收益")}</div>
                        <div className="text-[13px] font-bold" style={{ color: accentGreen }}>${dailyYieldUsd} <span className="text-[10px] font-normal text-white/40">(0.9%)</span></div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="text-[10px] text-white/30 mb-0.5">{t("profile.nodeStatus")}</div>
                        <div className={`text-[13px] font-bold ${memberActivatedRank ? 'text-green-400' : 'text-amber-400'}`}>
                          {memberActivatedRank ? `${t("profile.activatedLabel")} ${memberActivatedRank}` : t("profile.vaultNotActive")}
                        </div>
                      </div>
                    </div>

                    {/* Tx hash */}
                    {m.txHash && (
                      <div className="rounded-lg p-2.5" style={{ background: "rgba(10,186,181,0.04)", border: "1px solid rgba(10,186,181,0.1)" }}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] text-white/30 mb-0.5">{t("profile.txHash")}</div>
                            <div className="text-[11px] font-mono text-white/50 truncate">{m.txHash}</div>
                          </div>
                          <a
                            href={`https://bscscan.com/tx/${m.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                            style={{ background: "rgba(10,186,181,0.1)", border: "1px solid rgba(10,186,181,0.2)", color: tiffanyLight }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t("profile.viewOnChain")}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          )}

          {/* Earnings tab */}
          {activeTab === "earnings" && (
            <div className="space-y-2">
              {earningsRecords.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-sm">
                  {t("profile.noData")}
                </div>
              ) : (
                earningsRecords.map((r: any) => {
                  const usdAmount = Number(r.amount || 0);
                  const maPrice = Number(r.arPrice || r.details?.ar_price || 1);
                  const maAmount = Number(r.arAmount || r.details?.ar_amount || (usdAmount / maPrice));
                  const earningStatus = r.details?.status || "RELEASED";
                  const nodeType = r.details?.node_type || "--";
                  const statusCfg: Record<string, { label: string; color: string; border: string }> = {
                    RELEASED: { label: t("node.statusReleased", "已解锁"), color: "text-green-400/70", border: "rgba(34,197,94,0.12)" },
                    LOCKED: { label: t("node.statusLocked", "锁仓中"), color: "text-amber-400/70", border: "rgba(251,191,36,0.12)" },
                    PAUSED: { label: t("node.statusPaused", "已暂停"), color: "text-orange-400/70", border: "rgba(249,115,22,0.12)" },
                    DESTROYED: { label: t("node.statusDestroyed", "已销毁"), color: "text-red-400/70", border: "rgba(239,68,68,0.12)" },
                  };
                  const st = statusCfg[earningStatus] || statusCfg.RELEASED;

                  return (
                    <div
                      key={r.id}
                      className="rounded-xl p-3.5"
                      style={{ background: "#0e1216", border: `1px solid ${st.border}` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-white/80">
                            {r.rewardType === "FIXED_YIELD" ? t("profile.dailyEarnings") : t("profile.teamCommission")}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${st.color} bg-white/5`}>{st.label}</span>
                        </div>
                        <span className="text-[10px] text-white/25">{nodeType} · {formatDate(r.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-white/35">
                          ${usdAmount.toFixed(2)} × MA ${maPrice.toFixed(4)}
                        </div>
                        <div className={`text-sm font-bold font-mono ${earningStatus === "DESTROYED" ? "text-red-400/50 line-through" : ""}`} style={{ color: earningStatus === "DESTROYED" ? undefined : accentGreen }}>
                          {earningStatus === "DESTROYED" ? "" : "+"}{maAmount.toFixed(2)} MA
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      )}

      <NodePurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        nodeType={purchaseNodeType}
        walletAddr={walletAddr}
      />

      {/* Node Info Dialog */}
      <Dialog open={nodeInfoOpen} onOpenChange={setNodeInfoOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "#0e1216", border: "1px solid rgba(10,186,181,0.2)" }}>
          <DialogTitle className="text-lg font-bold text-white">{t("profile.nodeActivation")}</DialogTitle>
          <DialogDescription className="text-xs text-white/40">{t("profile.nodeActivationDesc")}</DialogDescription>

          <div className="space-y-5 mt-2">
            {/* Small Node Section */}
            <div>
              <h3 className="text-sm font-bold text-white mb-2" style={{ color: "#a5b4fc" }}>
                {t("profile.applySmallNode")} - {t("profile.activationTierTitle")}
              </h3>
              <div className="space-y-1.5">
                {NODE_ACTIVATION_TIERS.MINI.map((tier) => (
                  <div key={tier.rank} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.1)" }}>
                    <span className="text-xs font-bold" style={{ color: "#a5b4fc" }}>{tier.rank}</span>
                    <span className="text-xs text-white/60">{t("profile.vaultDepositRequired", { amount: tier.vaultDeposit })}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">{t("profile.earnStartNextDay")} - {t("profile.miniDailyEarning")}</p>

              <h4 className="text-xs font-bold text-white/60 mt-3 mb-1.5">{t("profile.qualificationTitle")}</h4>
              <div className="space-y-1.5">
                {NODE_QUALIFICATION_CHECKS.MINI.map((check, idx) => (
                  <div key={idx} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white/80">{t("profile.checkDayLabel", { day: check.checkDay })}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,0.1)", color: "#fbbf24" }}>
                        {check.requiredRank}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400/80">{check.passAction === "UNLOCK_PARTIAL" ? t("profile.passUnlockPartial") : check.passAction === "UNLOCK_ALL" ? t("profile.passUnlockAll") : t("profile.passUnlockFrozen", { amount: 1000 })}</div>
                    <div className="text-[11px] text-red-400/80">{check.failAction === "KEEP_LOCKED" ? t("profile.failKeepLocked") : check.failAction === "DESTROY" ? t("profile.failDestroy") : t("profile.failKeepFrozen")}</div>
                    {check.failAction !== "KEEP_FROZEN" && <div className="text-[10px] text-white/25 mt-0.5">{t("profile.rankDropActual")}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Large Node Section */}
            <div>
              <h3 className="text-sm font-bold text-white mb-2" style={{ color: "#81d8d0" }}>
                {t("profile.applyLargeNode")} - {t("profile.activationTierTitle")}
              </h3>
              <div className="space-y-1.5">
                {NODE_ACTIVATION_TIERS.MAX.map((tier) => (
                  <div key={tier.rank} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(10,186,181,0.06)", border: "1px solid rgba(10,186,181,0.1)" }}>
                    <span className="text-xs font-bold" style={{ color: "#81d8d0" }}>{tier.rank}</span>
                    <div className="text-right">
                      <span className="text-xs text-white/60">{t("profile.vaultDepositRequired", { amount: tier.vaultDeposit })}</span>
                      {tier.requiredMiniReferrals > 0 && (
                        <div className="text-[10px] text-amber-400/80">{t("profile.requiresMiniRefs", { count: tier.requiredMiniReferrals })}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">{t("profile.earnStartNextDay")} - {t("profile.maxDailyEarning")}</p>

              <h4 className="text-xs font-bold text-white/60 mt-3 mb-1.5">{t("profile.qualificationTitle")}</h4>
              <div className="space-y-1.5">
                {NODE_QUALIFICATION_CHECKS.MAX.map((check, idx) => (
                  <div key={idx} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white/80">{t("profile.checkDayLabel", { day: check.checkDay })}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,0.1)", color: "#fbbf24" }}>
                        {check.requiredRank}
                      </span>
                    </div>
                    {check.earningRange && (
                      <div className="text-[10px] text-white/30 mb-0.5">{t("profile.checkDayRange", { start: check.earningRange.split("-")[0], end: check.earningRange.split("-")[1] })}</div>
                    )}
                    <div className="text-[11px] text-emerald-400/80">{check.passAction === "CONTINUE" ? t("profile.passContinue") : t("profile.passUnlockFrozen", { amount: 6000 })}</div>
                    <div className="text-[11px] text-red-400/80">{check.failAction === "PAUSE" ? t("profile.failPause") : t("profile.failKeepFrozen")}</div>
                    {check.failAction === "PAUSE" && <div className="text-[10px] text-white/25 mt-0.5">{t("profile.rankDropActual")}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
