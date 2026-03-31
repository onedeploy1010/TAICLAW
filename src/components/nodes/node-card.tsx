import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Server, Shield, Calendar } from "lucide-react";
import type { NodeMembership } from "@shared/types";
import { MilestoneTracker } from "./milestone-tracker";
import { useTranslation } from "react-i18next";

interface NodeCardProps {
  node: NodeMembership;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-primary/15 text-primary",
  PENDING_MILESTONES: "bg-yellow-500/15 text-yellow-400",
  COMPLETED: "bg-blue-500/15 text-blue-400",
  CANCELLED: "bg-red-500/15 text-red-400",
  EXPIRED: "bg-muted text-muted-foreground",
};

const STATUS_KEYS: Record<string, string> = {
  ACTIVE: "profile.statusActive",
  PENDING_MILESTONES: "profile.statusPendingMilestones",
  COMPLETED: "profile.statusCompleted",
  CANCELLED: "profile.statusCancelled",
  EXPIRED: "profile.statusExpired",
};

export function NodeCard({ node }: NodeCardProps) {
  const { t } = useTranslation();
  const isMax = node.nodeType === "MAX";
  const capacity = Number(node.earningsCapacity || 0);
  const capacityPercent = Math.round(capacity * 100);
  const isEarlyBird = node.paymentMode === "EARLY_BIRD";

  return (
    <Card className={`border-border bg-card ${node.status === "ACTIVE" ? "glow-green-sm" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              {isMax ? <Server className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <div className="text-sm font-bold">{node.nodeType} {t("common.node")}</div>
              <div className="text-[11px] text-muted-foreground">
                ${Number(node.price).toLocaleString()}
                {isEarlyBird && ` · ${t("profile.earlyBirdDeposit")}`}
              </div>
            </div>
          </div>
          <Badge
            className={`text-[11px] no-default-hover-elevate no-default-active-elevate ${STATUS_COLORS[node.status] || "bg-muted text-muted-foreground"}`}
          >
            {t(STATUS_KEYS[node.status] || "common.status")}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <span className="text-muted-foreground">{t("profile.earningsCapacity")}</span>
            <div className="mt-1">
              <Progress value={capacityPercent} className="h-1.5" />
              <span className="text-[11px] text-primary font-medium">{t("profile.earningsUnlocked", { percent: capacityPercent })}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">{t("profile.milestoneProgress")}</span>
            <div className="text-sm font-bold mt-0.5">
              {t("profile.milestoneStage", { current: node.milestoneStage, total: node.totalMilestones })}
            </div>
          </div>
        </div>

        {node.startDate && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(node.startDate).toLocaleDateString()} — {node.endDate ? new Date(node.endDate).toLocaleDateString() : "—"}
          </div>
        )}

        {isEarlyBird && node.milestones && node.milestones.length > 0 && (
          <MilestoneTracker milestones={node.milestones} />
        )}
      </CardContent>
    </Card>
  );
}
