import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminGetLogs } from "@/admin/admin-api";
import { useAdminAuth } from "@/admin/admin-auth";

const PAGE_SIZE = 30;

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  create: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  update: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  delete: "bg-red-500/10 text-red-400 border-red-500/20",
  promotion: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  deposit: "bg-primary/10 text-primary border-primary/20",
  purchase: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const ACTION_FILTERS = ["", "login", "create", "update", "delete", "promotion", "deposit", "purchase"];

function getActionColor(action: string) {
  for (const key of Object.keys(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return ACTION_COLORS[key];
  }
  return "bg-white/[0.04] text-foreground/50 border-border/20";
}

export default function AdminLogs() {
  const { adminUser } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logs", page, actionFilter],
    queryFn: () => adminGetLogs(page, PAGE_SIZE, actionFilter || undefined),
    enabled: !!adminUser,
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg lg:text-xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          操作日志
          {total > 0 && <span className="text-sm font-normal text-foreground/40">({total})</span>}
        </h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-foreground/30 mr-1" />
        {ACTION_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setActionFilter(f); setPage(1); }}
            className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
              actionFilter === f
                ? "bg-primary/15 border-primary/30 text-primary font-bold"
                : "bg-white/[0.03] border-border/20 text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {f || "全部"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center text-foreground/30 py-16 text-sm">暂无日志</div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log: any) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-border/10 hover:bg-white/[0.015] transition-colors"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className={`text-[9px] h-4 px-1.5 border ${getActionColor(log.action)}`}>
                    {log.action}
                  </Badge>
                  <span className="text-[10px] text-foreground/30">{log.target_type}</span>
                  {log.target_id && (
                    <span className="text-[10px] font-mono text-foreground/20 truncate max-w-[120px]">{log.target_id}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-foreground/60">{log.admin_username}</span>
                  <Badge className="text-[8px] h-3.5 px-1 border bg-white/[0.03] text-foreground/30 border-border/15">
                    {log.admin_role}
                  </Badge>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-1 text-[10px] text-foreground/20 font-mono truncate">
                    {JSON.stringify(log.details).substring(0, 120)}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-foreground/20 shrink-0 tabular-nums">
                {new Date(log.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/40">{page} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  );
}
