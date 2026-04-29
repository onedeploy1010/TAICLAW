import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import {
  ArrowLeft, ArrowUpRight, WalletCards, Zap, ShieldCheck,
  TrendingUp, Lock, Unlock, Award, KeyRound, Loader2,
  ExternalLink, Info,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getNodeOverview, getNodeEarningsRecords, getNodeMemberships,
  getNodeMilestoneRequirements, validateAuthCode,
} from "@/lib/api";
import type { NodeOverview, NodeEarningsRecord, NodeMembership } from "@shared/types";
import { NODE_PLANS, NODE_MILESTONES, NODE_ACTIVATION_TIERS, NODE_QUALIFICATION_CHECKS } from "@/lib/data";
import { useTranslation } from "react-i18next";
import { useMaPrice } from "@/hooks/use-ma-price";
import { useToast } from "@/hooks/use-toast";
import { NodePurchaseDialog } from "@/components/nodes/node-purchase-section";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Color palette — official golden/amber theme */
const AMBER = "#f59e0b";
const AMBER_LIGHT = "#fbbf24";
const AMBER_BRIGHT = "#fcd34d";
const AMBER_DIM = "#d97706";

type TabKey = "purchase" | "earnings";

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

  const [authCodeDialogOpen, setAuthCodeDialogOpen] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [authCodeError, setAuthCodeError] = useState("");
  const [authCodeLoading, setAuthCodeLoading] = useState(false);
  const [validatedAuthCode, setValidatedAuthCode] = useState("");
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false);

  const handleMaxNodeClick = () => {
    setAuthCodeInput(""); setAuthCodeError(""); setAuthCodeDialogOpen(true);
  };

  const handleAuthCodeSubmit = async () => {
    if (authCodeInput.length !== 6) return;
    setAuthCodeLoading(true); setAuthCodeError("");
    try {
      const valid = await validateAuthCode(authCodeInput);
      if (valid) {
        setValidatedAuthCode(authCodeInput);
        setAuthCodeDialogOpen(false);
        setPurchaseNodeType("MAX");
        setPurchaseDialogOpen(true);
      } else {
        setAuthCodeError(t("profile.authCodeInvalid"));
      }
    } catch {
      setAuthCodeError(t("profile.authCodeInvalid"));
    } finally {
      setAuthCodeLoading(false);
    }
  };

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

  const nodes = overview?.nodes ?? [];
  const activeNodes = nodes.filter((n) => n.status === "ACTIVE" || n.status === "PENDING_MILESTONES");
  const hasAnyNode = activeNodes.length > 0;
  const hasMAX = hasAnyNode;
  const hasMINI = hasAnyNode;
  const activeCount = activeNodes.length;
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

  const activationTiers = nodeType === "MAX" ? NODE_ACTIVATION_TIERS.MAX : NODE_ACTIVATION_TIERS.MINI;
  const qualificationChecks = nodeType === "MAX" ? NODE_QUALIFICATION_CHECKS.MAX : NODE_QUALIFICATION_CHECKS.MINI;

  const currentActivationTier = activationTiers.filter(tier => {
    const meetsDeposit = vaultDeposited >= tier.vaultDeposit;
    const meetsRefs = tier.requiredMiniReferrals === 0 || directMiniReferrals >= tier.requiredMiniReferrals;
    return meetsDeposit && meetsRefs;
  }).pop();

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
  const progressPercent = totalDays > 0 ? Math.min(Math.max((daysActive / totalDays) * 100, 1), 100) : 0;

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pt-4" style={{ background: "#050505" }} data-testid="page-profile-nodes">

      {/* ── Page ambient glow ── */}
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute top-[50%] right-[5%] w-[350px] h-[350px] rounded-full bg-amber-600/[0.025] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-amber-500/10" style={{ background: "linear-gradient(180deg, rgba(30,20,5,0.95) 0%, rgba(10,8,3,0) 100%)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(251,191,36,0.10),transparent_55%)] pointer-events-none" />
        <div aria-hidden className="absolute inset-y-0 left-0 right-0 overflow-hidden pointer-events-none">
          <div className="animate-hero-sweep absolute top-0 bottom-0 w-[40%] bg-gradient-to-r from-transparent via-amber-400/[0.04] to-transparent" />
        </div>

        <div className="relative px-4 pt-3 pb-6">
          <div className="flex items-center justify-center relative mb-5 lg:justify-start">
            <button
              onClick={() => navigate("/profile")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors lg:hidden hover:bg-amber-500/10"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}
            >
              <ArrowLeft className="h-5 w-5 text-white/90" />
            </button>
            <h1 className="text-lg font-bold tracking-wide text-white">{t("profile.nodeDetailsTitle")}</h1>
            <button
              onClick={() => setNodeInfoOpen(true)}
              className="absolute right-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-amber-500/10"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}
            >
              <Info className="h-4 w-4 text-amber-400/70" />
            </button>
          </div>

          {/* Hero progress card */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <Card className="surface-3d relative overflow-hidden border-amber-500/50 bg-gradient-to-br from-amber-950/45 via-slate-900/80 to-slate-900/95">
              <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-amber-500/25 via-amber-600/10 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-gradient-to-tr from-amber-600/10 via-transparent to-transparent blur-3xl pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_50%)] pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

              {/* Ghost 符 watermark */}
              <div
                aria-hidden
                className="absolute bottom-[-15%] right-2 select-none pointer-events-none leading-none text-[clamp(7rem,35vw,14rem)] font-bold"
                style={{
                  color: "rgba(251,191,36,0.045)",
                  fontFamily: "'Cinzel', 'Noto Serif SC', STSong, serif",
                  filter: "blur(0.5px)",
                }}
              >
                符
              </div>

              <CardContent className="pt-5 pb-5 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white">{t("profile.myNodesLabel")}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/40 bg-amber-500/12 text-amber-300">
                      {activeCount} {t("common.active")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black num-gold">{daysActive}<span className="text-xs text-white/30 font-medium ml-0.5">/{totalDays || 0}</span></div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wider">{t("profile.dayUnit")}</div>
                  </div>
                </div>

                {/* Rank display */}
                {hasAnyNode && (
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/35 uppercase tracking-widest">{t("profile.currentRankLabel", "当前等级")}</span>
                      <span className="text-sm font-black num-gold">{currentRank}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/35 uppercase tracking-widest">{t("profile.targetRankLabel", "目标等级")}</span>
                      <span className="text-sm font-black px-2.5 py-0.5 rounded-lg border border-amber-500/40 bg-amber-500/12 text-amber-300">
                        {nodeType === "MAX" ? "V6" : "V4"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div className="relative mb-1">
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
                      className="h-full rounded-full relative overflow-hidden"
                      style={{
                        background: `linear-gradient(90deg, ${AMBER_DIM}, ${AMBER}, ${AMBER_BRIGHT})`,
                        boxShadow: `0 0 12px rgba(251,191,36,0.5)`,
                      }}
                    >
                      <div className="absolute inset-0 animate-bar-sweep" style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                      }} />
                    </motion.div>
                  </div>
                </div>

                {/* Milestone dots */}
                {activeNodes.length > 0 && milestones.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-end px-0.5">
                      {milestoneStates.map((ms, idx) => (
                        <div key={ms.rank} className="flex flex-col items-center" style={{ width: `${100 / milestones.length}%` }}>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center relative"
                            style={{
                              background: ms.isAchieved
                                ? `linear-gradient(135deg, ${AMBER}, ${AMBER_DIM})`
                                : ms.isCurrent
                                ? "linear-gradient(135deg, #fcd34d, #fbbf24)"
                                : ms.isFailed || ms.isExpired
                                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                                : "rgba(255,255,255,0.08)",
                              boxShadow: ms.isCurrent
                                ? "0 0 12px rgba(251,191,36,0.6)"
                                : ms.isAchieved
                                ? "0 0 8px rgba(245,158,11,0.5)"
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
                          <span className="text-[11px] mt-1 font-bold" style={{
                            color: ms.isAchieved ? AMBER_LIGHT
                              : ms.isCurrent ? AMBER_BRIGHT
                              : ms.isFailed || ms.isExpired ? "#f87171"
                              : "rgba(255,255,255,0.2)",
                          }}>
                            {ms.rank}
                          </span>
                        </div>
                      ))}
                    </div>

                    {currentMilestone && (
                      <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2 border border-amber-500/20 bg-amber-500/[0.06]">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" style={{ boxShadow: "0 0 6px rgba(251,191,36,0.6)" }} />
                        <span className="text-xs text-white/60 truncate font-medium flex-1">{getMilestoneDesc(currentMilestone)}</span>
                        {currentMilestone.days > 0 ? (
                          <span className="text-xs font-bold shrink-0" style={{ color: AMBER_LIGHT }}>{currentMilestone.daysLeft}{t("profile.daysLeft")}</span>
                        ) : (
                          <span className="text-xs font-bold text-white/25 shrink-0">{t("profile.noTimeLimit", "无限期")}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {!isConnected ? (
        <div className="px-4 mt-6">
          <div className="rounded-2xl p-10 text-center border border-amber-500/15 bg-amber-500/[0.03]">
            <WalletCards className="h-10 w-10 text-amber-400/30 mx-auto mb-3" />
            <p className="text-sm text-white/40">{t("profile.connectToViewNodes")}</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="px-4 mt-6 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="px-4 mt-5 space-y-4">

          {/* ── Purchase buttons ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* MAX node — primary amber */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
              whileHover={!hasMAX ? { y: -3, scale: 1.01 } : {}}
              whileTap={!hasMAX ? { scale: 0.97 } : {}}
              className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 relative overflow-hidden group text-left"
              style={{
                background: hasMAX
                  ? "linear-gradient(160deg, rgba(30,22,5,0.9), rgba(20,16,4,0.95))"
                  : "linear-gradient(160deg, #92400e, #78350f, #451a03)",
                border: hasMAX ? "2px solid rgba(251,191,36,0.15)" : "2px solid rgba(253,230,138,0.5)",
                boxShadow: hasMAX
                  ? "none"
                  : "0 6px 0 #451a03, 0 8px 24px rgba(245,158,11,0.35), 0 0 30px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)",
                opacity: hasMAX ? 0.75 : 1,
              }}
              onClick={() => {
                if (hasMAX) {
                  toast({ title: t("profile.alreadyPurchased"), description: t("profile.alreadyPurchasedDesc") });
                } else {
                  handleMaxNodeClick();
                }
              }}
            >
              {!hasMAX && (
                <>
                  <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-amber-400/30 blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-amber-600/20 blur-xl pointer-events-none" />
                  <div className="absolute top-0 left-[5%] right-[5%] h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent pointer-events-none" />
                </>
              )}
              <div className="relative z-10 flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: hasMAX ? "rgba(251,191,36,0.12)" : "linear-gradient(145deg, #fbbf24, #f59e0b)",
                    boxShadow: hasMAX ? "none" : "0 3px 12px rgba(251,191,36,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
                  }}
                >
                  <Zap className="h-5 w-5" style={{ color: hasMAX ? "rgba(251,191,36,0.4)" : "white" }} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[14px] font-extrabold tracking-tight" style={{ color: hasMAX ? "rgba(255,255,255,0.4)" : "white", textShadow: hasMAX ? "none" : "0 1px 4px rgba(0,0,0,0.5)" }}>
                    {t("profile.applyLargeNode")}
                  </div>
                  <div className="text-[15px] font-black mt-0.5" style={{ color: hasMAX ? "rgba(255,255,255,0.25)" : "white" }}>
                    ${NODE_PLANS.MAX.price} <span className="text-[11px] font-semibold opacity-60">USDT</span>
                  </div>
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-between w-full">
                <span className="text-[10px] font-medium" style={{ color: hasMAX ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)" }}>
                  {t("profile.nodeTotal")} ${NODE_PLANS.MAX.frozenAmount.toLocaleString()}
                </span>
                {hasMAX ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400/50">
                    {t("profile.alreadyPurchased")}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 border border-white/40 group-hover:bg-white/30 transition-colors">
                    <span className="text-[10px] font-extrabold tracking-wider text-white">GO</span>
                    <ArrowUpRight className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            </motion.button>

            {/* MINI node — amber secondary */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
              whileHover={!hasMINI ? { y: -3, scale: 1.01 } : {}}
              whileTap={!hasMINI ? { scale: 0.97 } : {}}
              className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 relative overflow-hidden group text-left"
              style={{
                background: hasMINI
                  ? "linear-gradient(160deg, rgba(20,18,5,0.9), rgba(14,13,4,0.95))"
                  : "linear-gradient(160deg, #78350f, #5c2a00, #3b1700)",
                border: hasMINI ? "2px solid rgba(251,191,36,0.12)" : "2px solid rgba(253,230,138,0.4)",
                boxShadow: hasMINI
                  ? "none"
                  : "0 6px 0 #3b1700, 0 8px 20px rgba(180,83,9,0.3), 0 0 24px rgba(217,119,6,0.12), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.2)",
                opacity: hasMINI ? 0.75 : 1,
              }}
              onClick={() => {
                if (hasMINI) {
                  toast({ title: t("profile.alreadyPurchased"), description: t("profile.alreadyPurchasedDesc") });
                } else {
                  setPurchaseNodeType("MINI"); setPurchaseDialogOpen(true);
                }
              }}
            >
              {!hasMINI && (
                <>
                  <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-amber-700/30 blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-amber-800/20 blur-xl pointer-events-none" />
                  <div className="absolute top-0 left-[5%] right-[5%] h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent pointer-events-none" />
                </>
              )}
              <div className="relative z-10 flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: hasMINI ? "rgba(180,83,9,0.15)" : "linear-gradient(145deg, #fcd34d, #d97706)",
                    boxShadow: hasMINI ? "none" : "0 3px 12px rgba(217,119,6,0.45), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.15)",
                  }}
                >
                  <ShieldCheck className="h-5 w-5" style={{ color: hasMINI ? "rgba(217,119,6,0.4)" : "white" }} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[14px] font-extrabold tracking-tight" style={{ color: hasMINI ? "rgba(255,255,255,0.4)" : "white", textShadow: hasMINI ? "none" : "0 1px 4px rgba(0,0,0,0.5)" }}>
                    {t("profile.applySmallNode")}
                  </div>
                  <div className="text-[15px] font-black mt-0.5" style={{ color: hasMINI ? "rgba(255,255,255,0.25)" : "white" }}>
                    ${NODE_PLANS.MINI.price} <span className="text-[11px] font-semibold opacity-60">USDT</span>
                  </div>
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-between w-full">
                <span className="text-[10px] font-medium" style={{ color: hasMINI ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)" }}>
                  {t("profile.nodeTotal")} ${NODE_PLANS.MINI.frozenAmount.toLocaleString()}
                </span>
                {hasMINI ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-600/20 bg-amber-600/10 text-amber-500/50">
                    {t("profile.alreadyPurchased")}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/18 border border-white/35 group-hover:bg-white/25 transition-colors">
                    <span className="text-[10px] font-extrabold tracking-wider text-white">GO</span>
                    <ArrowUpRight className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            </motion.button>
          </div>

          {/* ── KPI stats grid ── */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12, ease: EASE }}>
              <Card className="surface-3d relative overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-900/20 to-slate-800/80 h-full">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingUp className="h-4 w-4 text-amber-400/70" />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{t("profile.nodeTotalAmount")}</span>
                  </div>
                  <div className="text-xl font-black num-gold">${nodeFrozenTotal.toLocaleString()}</div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16, ease: EASE }}>
              <Card className="surface-3d relative overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-900/20 to-slate-800/80 h-full">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Unlock className="h-4 w-4 text-amber-400/70" />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{t("profile.releasedEarnings")}</span>
                  </div>
                  <div className="text-xl font-black num-gold">{formatCompactMA(releasedEarnings)}</div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.20, ease: EASE }}>
              <Card className="surface-3d relative overflow-hidden border-white/12 bg-gradient-to-br from-slate-700/60 to-slate-800/80 h-full">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Award className="h-4 w-4 text-amber-400/60" />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{t("profile.releaseStatus")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                      background: activatedRank
                        ? (isEarningsPaused ? AMBER : "#22c55e")
                        : "rgba(255,255,255,0.2)",
                      boxShadow: activatedRank ? `0 0 6px ${isEarningsPaused ? AMBER : "#22c55e"}60` : "none",
                    }} />
                    <span className="text-sm font-bold" style={{
                      color: activatedRank
                        ? (isEarningsPaused ? AMBER_LIGHT : "#86efac")
                        : "rgba(255,255,255,0.4)",
                    }}>{releaseStatus}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.24, ease: EASE }}>
              <Card className="surface-3d relative overflow-hidden border-white/12 bg-gradient-to-br from-slate-700/60 to-slate-800/80 h-full">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Lock className="h-4 w-4 text-amber-400/60" />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{t("profile.availableBalance")}</span>
                  </div>
                  <div className="text-base font-bold text-white">{formatCompactMA(availableBalance)}</div>
                  <div className="text-[11px] text-white/25 mt-0.5">/ {formatCompactMA(lockedEarnings)}</div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Tab switcher ── */}
          <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/30 p-1 text-[12px] relative">
            {([
              { key: "purchase" as TabKey, label: t("profile.purchaseRecords") },
              { key: "earnings" as TabKey, label: t("profile.earningsDetailTab") },
            ]).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-5 py-1.5 rounded-full font-semibold transition-all duration-300 ${
                    active ? "text-amber-900" : "text-muted-foreground/77 hover:text-white/80"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nodeTabPill"
                      className="absolute inset-0 rounded-full bg-amber-400"
                      transition={{ duration: 0.3, ease: EASE }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait">
            {activeTab === "purchase" ? (
              <motion.div
                key="purchase"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="space-y-2"
              >
                {allMemberships.length === 0 ? (
                  <div className="text-center py-14 text-white/30 text-sm">{t("profile.noData")}</div>
                ) : (
                  allMemberships.map((m: any) => {
                    const isMax = m.nodeType === "MAX";
                    return (
                      <Card key={m.id} className="surface-3d relative overflow-hidden border-amber-500/25 bg-gradient-to-br from-slate-700/80 to-slate-800/90">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
                                background: "rgba(251,191,36,0.12)",
                                border: "1px solid rgba(251,191,36,0.2)",
                              }}>
                                {isMax ? <Zap className="h-4 w-4 text-amber-400" /> : <ShieldCheck className="h-4 w-4 text-amber-400" />}
                              </div>
                              <div>
                                <span className="text-[14px] font-bold text-white">
                                  {isMax ? t("profile.applyLargeNode") : t("profile.applySmallNode")}
                                </span>
                                <div className="text-[11px] text-white/30 mt-0.5">{formatDate(m.startDate)}</div>
                              </div>
                            </div>
                            <span className="text-[11px] px-2.5 py-1 rounded-full font-bold border" style={{
                              color: m.activatedRank ? "#86efac" : AMBER_LIGHT,
                              background: m.activatedRank ? "rgba(34,197,94,0.1)" : "rgba(251,191,36,0.1)",
                              borderColor: m.activatedRank ? "rgba(34,197,94,0.2)" : "rgba(251,191,36,0.25)",
                            }}>
                              {m.activatedRank ? `${t("profile.activatedLabel")} ${m.activatedRank}` : t("profile.vaultNotActive")}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: t("profile.contribution"), value: `${isMax ? "600" : "100"} USDT` },
                              { label: t("profile.nodeTotal"), value: `$${(isMax ? NODE_PLANS.MAX.frozenAmount : NODE_PLANS.MINI.frozenAmount).toLocaleString()}` },
                              { label: t("profile.dailyRelease"), value: "0.9%", gold: true },
                              { label: t("profile.nodeStatus"), value: t("profile.vaultNotActive"), amber: true },
                            ].map((item, i) => (
                              <div key={i} className="rounded-lg p-2.5 border border-white/6 bg-white/[0.03]">
                                <div className="text-[10px] text-white/30 mb-0.5">{item.label}</div>
                                <div className={`text-[13px] font-bold ${item.gold ? "text-amber-300" : item.amber ? "text-amber-400" : "text-white"}`}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                          {m.txHash && (
                            <div className="rounded-lg p-2.5 border border-amber-500/10 bg-amber-500/[0.04]">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] text-white/30 mb-0.5">{t("profile.txHash")}</div>
                                  <div className="text-[11px] font-mono text-white/45 truncate">{m.txHash}</div>
                                </div>
                                <a
                                  href={`https://bscscan.com/tx/${m.txHash}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 transition-all hover:bg-amber-500/20"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {t("profile.viewOnChain")}
                                </a>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </motion.div>
            ) : (
              <motion.div
                key="earnings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="space-y-2"
              >
                {earningsRecords.length === 0 ? (
                  <div className="text-center py-14 text-white/30 text-sm">{t("profile.noData")}</div>
                ) : (
                  earningsRecords.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl p-4 flex items-center justify-between border border-white/8 bg-white/[0.03]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white/90">
                          {r.rewardType === "FIXED_YIELD" ? t("profile.dailyEarnings") :
                           r.rewardType === "POOL_DIVIDEND" ? t("profile.poolDividend") :
                           t("profile.teamCommission")}
                        </div>
                        <div className="text-xs text-white/30">
                          {r.details?.node_type || "--"} · {formatDate(r.createdAt)}
                        </div>
                      </div>
                      <div className="text-base font-bold num-gold">
                        +{formatMA(Number(r.amount || 0))}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Auth code dialog ── */}
      <Dialog open={authCodeDialogOpen} onOpenChange={setAuthCodeDialogOpen}>
        <DialogContent
          className="w-[calc(100vw-32px)] max-w-[340px] p-0 overflow-hidden"
          style={{
            background: "#111008",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 20,
            boxShadow: "0 25px 60px rgba(0,0,0,0.75), 0 0 40px rgba(251,191,36,0.08)",
          }}
        >
          <DialogTitle className="sr-only">{t("profile.authCodeLabel")}</DialogTitle>
          <DialogDescription className="sr-only">{t("profile.authCodeRequired")}</DialogDescription>
          <div className="px-5 pt-6 pb-2">
            <div className="text-center mb-4">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 20px rgba(245,158,11,0.4)" }}
              >
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-[16px] font-bold text-white">{t("profile.authCodeLabel")}</h3>
              <p className="text-[11px] text-white/40 mt-1">{t("profile.authCodeRequired")}</p>
            </div>
          </div>
          <div className="px-5 pb-6 space-y-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={authCodeInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setAuthCodeInput(v);
                setAuthCodeError("");
              }}
              placeholder="000000"
              className="w-full h-14 rounded-xl px-4 text-[24px] font-mono font-bold text-white placeholder:text-white/15 outline-none text-center tracking-[0.5em]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: authCodeError ? "2px solid rgba(239,68,68,0.6)" : "2px solid rgba(251,191,36,0.25)",
                boxShadow: authCodeError ? "0 0 12px rgba(239,68,68,0.1)" : "0 0 12px rgba(251,191,36,0.06)",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAuthCodeSubmit()}
              autoFocus
            />
            {authCodeError && <p className="text-[12px] text-red-400 text-center">{authCodeError}</p>}
            <button
              onClick={handleAuthCodeSubmit}
              disabled={authCodeLoading || authCodeInput.length !== 6}
              className="w-full h-12 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}
            >
              {authCodeLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t("common.confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <NodePurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        nodeType={purchaseNodeType}
        walletAddr={walletAddr}
        authCode={validatedAuthCode}
      />

      {/* ── Node info dialog ── */}
      <Dialog open={nodeInfoOpen} onOpenChange={setNodeInfoOpen}>
        <DialogContent
          className="max-w-md max-h-[85vh] overflow-y-auto node-dialog-scroll"
          style={{ background: "#0e0c06", border: "1px solid rgba(251,191,36,0.2)" }}
        >
          <DialogTitle className="text-lg font-bold text-white">{t("profile.nodeActivation")}</DialogTitle>
          <DialogDescription className="text-xs text-white/40">{t("profile.nodeActivationDesc")}</DialogDescription>

          <div className="space-y-5 mt-2">
            {/* Small Node Section */}
            <div>
              <h3 className="text-sm font-bold mb-2" style={{ color: AMBER_LIGHT }}>
                {t("profile.applySmallNode")} - {t("profile.activationTierTitle")}
              </h3>
              <div className="space-y-1.5">
                {NODE_ACTIVATION_TIERS.MINI.map((tier) => (
                  <div key={tier.rank} className="flex items-center justify-between rounded-lg px-3 py-2 border border-amber-500/10 bg-amber-500/[0.04]">
                    <span className="text-xs font-bold text-amber-300">{tier.rank}</span>
                    <span className="text-xs text-white/60">{t("profile.vaultDepositRequired", { amount: tier.vaultDeposit })}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">{t("profile.earnStartNextDay")} - {t("profile.miniDailyEarning")}</p>

              <h4 className="text-xs font-bold text-white/50 mt-3 mb-1.5">{t("profile.qualificationTitle")}</h4>
              <div className="space-y-1.5">
                {NODE_QUALIFICATION_CHECKS.MINI.map((check, idx) => (
                  <div key={idx} className="rounded-lg px-3 py-2 border border-white/6 bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white/80">{t("profile.checkDayLabel", { day: check.checkDay })}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                        {check.requiredRank}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-400/80">{check.passAction === "UNLOCK_PARTIAL" ? t("profile.passUnlockPartial") : check.passAction === "UNLOCK_ALL" ? t("profile.passUnlockAll") : t("profile.passUnlockFrozen", { amount: 1000 })}</div>
                    <div className="text-[11px] text-red-400/80">{check.failAction === "KEEP_LOCKED" ? t("profile.failKeepLocked") : check.failAction === "DESTROY" ? t("profile.failDestroy") : t("profile.failKeepFrozen")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Large Node Section */}
            <div>
              <h3 className="text-sm font-bold mb-2" style={{ color: AMBER_BRIGHT }}>
                {t("profile.applyLargeNode")} - {t("profile.activationTierTitle")}
              </h3>
              <div className="space-y-1.5">
                {NODE_ACTIVATION_TIERS.MAX.map((tier) => (
                  <div key={tier.rank} className="flex items-center justify-between rounded-lg px-3 py-2 border border-amber-500/15 bg-amber-500/[0.05]">
                    <span className="text-xs font-bold text-amber-200">{tier.rank}</span>
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

              <h4 className="text-xs font-bold text-white/50 mt-3 mb-1.5">{t("profile.qualificationTitle")}</h4>
              <div className="space-y-1.5">
                {NODE_QUALIFICATION_CHECKS.MAX.map((check, idx) => (
                  <div key={idx} className="rounded-lg px-3 py-2 border border-white/6 bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white/80">{t("profile.checkDayLabel", { day: check.checkDay })}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                        {check.requiredRank}
                      </span>
                    </div>
                    {check.earningRange && (
                      <div className="text-[10px] text-white/30 mb-0.5">{t("profile.checkDayRange", { start: check.earningRange.split("-")[0], end: check.earningRange.split("-")[1] })}</div>
                    )}
                    <div className="text-[11px] text-amber-400/80">{check.passAction === "CONTINUE" ? t("profile.passContinue") : t("profile.passUnlockFrozen", { amount: 6000 })}</div>
                    <div className="text-[11px] text-red-400/80">{check.failAction === "PAUSE" ? t("profile.failPause") : t("profile.failKeepFrozen")}</div>
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
