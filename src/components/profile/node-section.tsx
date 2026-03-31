import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "thirdweb/react";
import { useQuery } from "@tanstack/react-query";
import { getNodeOverview } from "@/lib/api";
import { formatCompact } from "@/lib/constants";
import { Server, Shield, ChevronRight } from "lucide-react";
import type { NodeOverview } from "@shared/types";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function NodeSection() {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const [, navigate] = useLocation();
  const walletAddr = account?.address || "";

  const { data: overview, isLoading } = useQuery<NodeOverview>({
    queryKey: ["node-overview", walletAddr],
    queryFn: () => getNodeOverview(walletAddr),
    enabled: !!walletAddr,
  });

  const nodes = overview?.nodes ?? [];
  const activeCount = nodes.filter((n) => n.status === "ACTIVE" || n.status === "PENDING_MILESTONES").length;
  const totalEarnings = Number(overview?.rewards?.totalEarnings || 0);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease-out 0.2s both" }}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-bold">{t("profile.nodeMembership")}</h3>
        {activeCount > 0 && (
          <Badge className="text-[12px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-node-count">
            {activeCount} {t("profile.activeNodes")}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-md" />
      ) : activeCount > 0 ? (
        <Card className="border-border bg-card glow-green-sm" data-testid="card-active-node">
          <CardContent className="p-4">
            <button
              className="w-full flex items-center gap-3 text-left hover-elevate"
              onClick={() => navigate("/profile/nodes")}
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {activeCount} {activeCount === 1 ? t("common.node") : t("profile.activeNodes")}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {t("profile.totalEarnings")}: {formatCompact(totalEarnings)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card" data-testid="card-node-upgrade">
          <CardContent className="p-4">
            <button
              className="w-full flex items-center gap-3 text-left hover-elevate"
              onClick={() => navigate("/profile/nodes")}
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{t("profile.becomeNodeOperator")}</div>
                <div className="text-[12px] text-muted-foreground">{t("profile.unlockReferralBonuses")}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
