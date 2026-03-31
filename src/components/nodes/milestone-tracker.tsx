import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { NodeMilestone } from "@shared/types";
import { useTranslation } from "react-i18next";

interface MilestoneTrackerProps {
  milestones: NodeMilestone[];
}

export function MilestoneTracker({ milestones }: MilestoneTrackerProps) {
  const { t } = useTranslation();

  if (!milestones.length) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-semibold text-muted-foreground mb-1">
        {t("profile.milestoneProgress")}
      </div>
      <div className="flex items-center gap-1">
        {milestones.map((ms, idx) => {
          const isAchieved = ms.status === "ACHIEVED";
          const isFailed = ms.status === "FAILED";
          const isPending = ms.status === "PENDING";

          let bg = "bg-muted";
          if (isAchieved) bg = "bg-primary";
          else if (isFailed) bg = "bg-red-500";
          else if (isPending) bg = "bg-yellow-500/60";

          return (
            <div key={ms.id} className="flex items-center gap-1">
              <div className={`h-2 flex-1 rounded-full ${bg}`} style={{ minWidth: `${100 / milestones.length}%` }} />
              {idx < milestones.length - 1 && <div className="w-0.5" />}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {milestones.map((ms) => {
          const isAchieved = ms.status === "ACHIEVED";
          const isFailed = ms.status === "FAILED";

          const daysLeft = ms.deadlineAt
            ? Math.max(0, Math.ceil((new Date(ms.deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 0;

          return (
            <Badge
              key={ms.id}
              variant="outline"
              className={`text-[10px] gap-0.5 no-default-hover-elevate no-default-active-elevate ${
                isAchieved
                  ? "border-primary/40 text-primary"
                  : isFailed
                  ? "border-red-500/40 text-red-400"
                  : "border-yellow-500/40 text-yellow-400"
              }`}
            >
              {isAchieved ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : isFailed ? (
                <XCircle className="h-2.5 w-2.5" />
              ) : (
                <Clock className="h-2.5 w-2.5" />
              )}
              {ms.requiredRank}
              {!isAchieved && !isFailed && ` · ${t("profile.daysRemaining", { days: daysLeft })}`}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
