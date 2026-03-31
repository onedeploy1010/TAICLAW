import { Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { NodeMembership } from "@shared/types";
import { NodeCard } from "./node-card";
import { useTranslation } from "react-i18next";

interface NodeListProps {
  nodes: NodeMembership[];
}

export function NodeList({ nodes }: NodeListProps) {
  const { t } = useTranslation();

  if (!nodes.length) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{t("profile.noNodes")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <NodeCard key={node.id} node={node} />
      ))}
    </div>
  );
}
