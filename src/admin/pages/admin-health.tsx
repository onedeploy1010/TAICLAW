/**
 * Admin Health Check / Environment Monitor
 *
 * Monitors:
 * 1. AI API connectivity & response time (OpenAI, Claude, Gemini, DeepSeek, Cloudflare)
 * 2. Supabase edge functions health (cron jobs + on-demand functions)
 * 3. Mac Mini OpenClaw agent status
 * 4. Data freshness (ai_market_analysis, paper_trades, trade_signals)
 * 5. API usage / remaining quotas
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/admin/admin-auth";
import { cn } from "@/lib/utils";
import { Activity, RefreshCw, Wifi, WifiOff, Clock, Database, Cpu, AlertTriangle, CheckCircle2, XCircle, Server, Zap } from "lucide-react";

// ── Types ──

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

interface ServiceCheck {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  lastSuccess: string | null;
  message: string;
  details?: Record<string, any>;
}

interface CronJobStatus {
  name: string;
  schedule: string;
  lastRun: string | null;
  expectedInterval: number; // minutes
  status: HealthStatus;
  message: string;
}

interface DataFreshness {
  table: string;
  label: string;
  latestRecord: string | null;
  recordCount24h: number;
  expectedMinPerHour: number;
  status: HealthStatus;
  message: string;
}

// ── Constants ──

const AI_MODELS = [
  { id: "GPT-4o", provider: "OpenAI", icon: "🟢" },
  { id: "Claude", provider: "Anthropic", icon: "🟠" },
  { id: "Gemini", provider: "Google", icon: "🔵" },
  { id: "DeepSeek", provider: "DeepSeek", icon: "🟣" },
  { id: "Llama", provider: "Cloudflare", icon: "🦙" },
];

const CRON_JOBS: { name: string; schedule: string; expectedInterval: number; desc: string }[] = [
  { name: "simulate-trading", schedule: "*/5 * * * *", expectedInterval: 5, desc: "AI模拟开单" },
  { name: "ai-market-analysis", schedule: "*/30 * * * *", expectedInterval: 30, desc: "AI市场分析" },
  { name: "resolve-predictions", schedule: "*/5 * * * *", expectedInterval: 5, desc: "预测结算" },
  { name: "adjust-weights", schedule: "0 * * * *", expectedInterval: 60, desc: "权重调整" },
  { name: "close-expired-trades", schedule: "*/10 * * * *", expectedInterval: 10, desc: "过期平仓" },
];


// ── Helpers ──

function timeSince(iso: string | null): string {
  if (!iso) return "无数据";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "刚刚";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}秒前`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}分前`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}小时前`;
  return `${Math.floor(ms / 86400_000)}天前`;
}

function statusColor(s: HealthStatus) {
  switch (s) {
    case "healthy": return { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", dot: "bg-green-400" };
    case "warning": return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-400" };
    case "critical": return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" };
    default: return { text: "text-foreground/30", bg: "bg-white/[0.02]", border: "border-white/[0.06]", dot: "bg-foreground/20" };
  }
}

function StatusIcon({ status }: { status: HealthStatus }) {
  switch (status) {
    case "healthy": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case "critical": return <XCircle className="h-4 w-4 text-red-400" />;
    default: return <Clock className="h-4 w-4 text-foreground/25" />;
  }
}

// ── Main Component ──

export default function AdminHealth() {
  const { adminUser } = useAdminAuth();
  const [refreshing, setRefreshing] = useState(false);

  // ── 1. AI Model Health — check recent ai_market_analysis per model ──
  const { data: modelChecks = [], refetch: refetchModels } = useQuery({
    queryKey: ["admin", "health", "models"],
    queryFn: async (): Promise<ServiceCheck[]> => {
      const result = await fetch("/api/admin/health/models").then(r => r.json()).catch(() => []);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!adminUser,
    refetchInterval: 60_000,
  });

  // ── 2. Mac Mini OpenClaw Agent ──
  const { data: macMiniCheck, refetch: refetchMacMini } = useQuery({
    queryKey: ["admin", "health", "macmini"],
    queryFn: async (): Promise<ServiceCheck> => {
      const result = await fetch("/api/admin/health/macmini").then(r => r.json()).catch(() => null);
      return result || { name: "🖥 Mac Mini OpenClaw", status: "unknown", latencyMs: null, lastSuccess: null, message: "无数据", details: {} };
    },
    enabled: !!adminUser,
    refetchInterval: 60_000,
  });

  // ── 3. Cron Jobs / Edge Functions ──
  const { data: cronChecks = [], refetch: refetchCrons } = useQuery({
    queryKey: ["admin", "health", "crons"],
    queryFn: async (): Promise<CronJobStatus[]> => {
      const result = await fetch("/api/admin/health/crons").then(r => r.json()).catch(() => []);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!adminUser,
    refetchInterval: 60_000,
  });

  // ── 4. Data Freshness ──
  const { data: dataChecks = [], refetch: refetchData } = useQuery({
    queryKey: ["admin", "health", "data"],
    queryFn: async (): Promise<DataFreshness[]> => {
      const result = await fetch("/api/admin/health/data-freshness").then(r => r.json()).catch(() => []);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!adminUser,
    refetchInterval: 120_000,
  });

  // ── 5. API Usage ──
  const { data: apiUsage = [], refetch: refetchUsage } = useQuery({
    queryKey: ["admin", "health", "usage"],
    queryFn: async () => {
      const result = await fetch("/api/admin/health/api-usage").then(r => r.json()).catch(() => []);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!adminUser,
    refetchInterval: 300_000,
  });


  // ── Refresh all ──
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchModels(), refetchMacMini(), refetchCrons(), refetchData(), refetchUsage()]);
    setRefreshing(false);
  }, [refetchModels, refetchMacMini, refetchCrons, refetchData, refetchUsage]);

  // ── Overall status ──
  const allStatuses = [
    ...modelChecks.map(c => c.status),
    macMiniCheck?.status ?? "unknown",
    ...cronChecks.map(c => c.status),
    ...dataChecks.map(c => c.status),
  ];
  const hasCritical = allStatuses.includes("critical");
  const hasWarning = allStatuses.includes("warning");
  const overallStatus: HealthStatus = hasCritical ? "critical" : hasWarning ? "warning" : "healthy";
  const overall = statusColor(overallStatus);

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-base lg:text-lg font-bold text-foreground/80">环境健康检查</h1>
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold", overall.bg, overall.text, "border", overall.border)}>
            <div className={cn("w-2 h-2 rounded-full", overall.dot, overallStatus === "healthy" && "animate-pulse")} />
            {overallStatus === "healthy" ? "全部正常" : overallStatus === "warning" ? "部分警告" : "存在异常"}
          </div>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/8 hover:bg-primary/15 transition-colors"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          刷新
        </button>
      </div>

      {/* Critical alerts banner */}
      {hasCritical && (
        <div className="rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">检测到异常服务</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              {allStatuses.filter(s => s === "critical").length} 个服务异常，可能影响 AI 分析和交易信号生成，请立即排查。
            </p>
          </div>
        </div>
      )}

      {/* ── Section 1: AI Models ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary/60" />
          <h2 className="text-sm font-bold text-foreground/60">AI 模型连接状态</h2>
        </div>
        <div className="p-4 lg:p-5 grid gap-2">
          {modelChecks.map((check) => {
            const sc = statusColor(check.status);
            return (
              <div key={check.name} className={cn("flex items-center justify-between px-4 py-3 rounded-xl border", sc.border, sc.bg)}>
                <div className="flex items-center gap-3">
                  <StatusIcon status={check.status} />
                  <div>
                    <p className="text-xs font-bold text-foreground/70">{check.name}</p>
                    <p className="text-[10px] text-foreground/30">{check.details?.provider}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-semibold", sc.text)}>{check.message}</p>
                  <p className="text-[10px] text-foreground/20">
                    {check.lastSuccess ? timeSince(check.lastSuccess) : "无数据"}
                    {check.details?.lastAsset && ` · ${check.details.lastAsset}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Mac Mini OpenClaw ── */}
      {macMiniCheck && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary/60" />
            <h2 className="text-sm font-bold text-foreground/60">Mac Mini 本地代理</h2>
          </div>
          <div className="p-4 lg:p-5">
            {(() => {
              const sc = statusColor(macMiniCheck.status);
              return (
                <div className={cn("px-4 py-4 rounded-xl border", sc.border, sc.bg)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={macMiniCheck.status} />
                      <div>
                        <p className="text-sm font-bold text-foreground/70">{macMiniCheck.name}</p>
                        <p className="text-[10px] text-foreground/25 mt-0.5">Ollama llama3.1:8b + qwen2.5:14b · 每15分钟分析</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-bold", sc.text)}>{macMiniCheck.message}</p>
                      <p className="text-[10px] text-foreground/20 mt-0.5">
                        最近推送: {macMiniCheck.lastSuccess ? timeSince(macMiniCheck.lastSuccess) : "从未"}
                      </p>
                    </div>
                  </div>
                  {macMiniCheck.details?.reasoning && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-black/20 text-[10px] text-foreground/30 leading-relaxed truncate">
                      {macMiniCheck.details.reasoning}
                    </div>
                  )}
                  {macMiniCheck.status === "critical" && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/15">
                      <p className="text-[11px] text-red-400/80">
                        排查步骤：1) SSH 到 Mac Mini 检查 OpenClaw 进程 2) 检查 Ollama 是否运行 (curl localhost:11434) 3) 查看 agent 日志
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Section 3: Cron Jobs / Edge Functions ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Server className="h-4 w-4 text-primary/60" />
          <h2 className="text-sm font-bold text-foreground/60">定时任务 / Edge Functions</h2>
        </div>
        <div className="p-4 lg:p-5">
          <div className="space-y-2">
            {cronChecks.map((cron) => {
              const sc = statusColor(cron.status);
              return (
                <div key={cron.name} className={cn("flex items-center justify-between px-4 py-3 rounded-xl border", sc.border, "bg-white/[0.01]")}>
                  <div className="flex items-center gap-3">
                    <StatusIcon status={cron.status} />
                    <div>
                      <p className="text-xs font-bold text-foreground/60">{cron.name}</p>
                      <p className="text-[10px] text-foreground/20 font-mono">{cron.schedule}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-semibold", sc.text)}>{cron.message}</p>
                    <p className="text-[10px] text-foreground/20">间隔: {cron.expectedInterval}分</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 4: Data Freshness ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Database className="h-4 w-4 text-primary/60" />
          <h2 className="text-sm font-bold text-foreground/60">数据健康</h2>
        </div>
        <div className="p-4 lg:p-5">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-foreground/30 border-b border-white/[0.06]">
                  <th className="text-left py-2 font-medium">数据表</th>
                  <th className="text-left py-2 font-medium">状态</th>
                  <th className="text-right py-2 font-medium">最新记录</th>
                  <th className="text-right py-2 font-medium">24h 数据量</th>
                  <th className="text-right py-2 font-medium">期望 / 小时</th>
                </tr>
              </thead>
              <tbody>
                {dataChecks.map((d) => {
                  const sc = statusColor(d.status);
                  return (
                    <tr key={d.table} className="border-b border-white/[0.03]">
                      <td className="py-2.5">
                        <p className="font-semibold text-foreground/60">{d.label}</p>
                        <p className="text-[10px] text-foreground/20 font-mono">{d.table}</p>
                      </td>
                      <td className="py-2.5">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", sc.bg, sc.text, "border", sc.border)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                          {d.status === "healthy" ? "正常" : d.status === "warning" ? "警告" : "异常"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-foreground/40">{d.latestRecord ? timeSince(d.latestRecord) : "无"}</td>
                      <td className="py-2.5 text-right font-bold text-foreground/60">{d.recordCount24h.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-foreground/30">≥{d.expectedMinPerHour}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {dataChecks.map((d) => {
              const sc = statusColor(d.status);
              return (
                <div key={d.table} className={cn("px-3.5 py-3 rounded-xl border", sc.border, "bg-white/[0.01]")}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-foreground/60">{d.label}</p>
                    <StatusIcon status={d.status} />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground/25">最新: {d.latestRecord ? timeSince(d.latestRecord) : "无"}</span>
                    <span className="text-foreground/40 font-bold">{d.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 5: API Usage ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Wifi className="h-4 w-4 text-primary/60" />
          <h2 className="text-sm font-bold text-foreground/60">API 用量统计</h2>
        </div>
        <div className="p-4 lg:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {apiUsage.map((u) => (
              <div key={u.model} className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{u.icon}</span>
                    <span className="text-xs font-bold text-foreground/60">{u.model}</span>
                  </div>
                  <span className="text-[9px] text-foreground/20 bg-white/[0.04] px-1.5 py-0.5 rounded">{u.tier}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-black text-foreground/70">{u.today}</p>
                    <p className="text-[9px] text-foreground/20">今日</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground/70">{u.month}</p>
                    <p className="text-[9px] text-foreground/20">本月</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary/60">~{u.estimateMonthly}</p>
                    <p className="text-[9px] text-foreground/20">预估月用量</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
            <p className="text-[10px] text-yellow-400/60 leading-relaxed">
              用量统计基于 ai_market_analysis 表中各模型的调用记录。实际 API 费用请登录各服务商后台查看。
              如发现某模型长时间无调用记录，请检查对应 API Key 是否过期或额度耗尽。
            </p>
          </div>
        </div>
      </div>

      {/* ── Environment Info ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 lg:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Server className="h-4 w-4 text-primary/60" />
          <h2 className="text-sm font-bold text-foreground/60">环境信息</h2>
        </div>
        <div className="p-4 lg:p-5 space-y-2 text-xs">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
            <span className="text-foreground/30">Supabase 项目</span>
            <span className="text-foreground/50 font-mono text-[10px]">enedbksmftcgtszrkppc</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
            <span className="text-foreground/30">Mac Mini Agent</span>
            <span className="text-foreground/50 font-mono text-[10px]">127.0.0.1:18789 (OpenClaw)</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
            <span className="text-foreground/30">AI 模型数量</span>
            <span className="text-foreground/50">5 (GPT-4o, Claude, Gemini, DeepSeek, Llama)</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
            <span className="text-foreground/30">定时任务数量</span>
            <span className="text-foreground/50">5 个 cron job</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
            <span className="text-foreground/30">交易共识要求</span>
            <span className="text-foreground/50">≥2 个模型一致</span>
          </div>
        </div>
      </div>
    </div>
  );
}
