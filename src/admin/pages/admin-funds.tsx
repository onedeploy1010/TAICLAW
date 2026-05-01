import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requireAdmin } from "@/admin/admin-auth";
import { adminGetVaultDeposits, adminGetTransactions } from "@/admin/admin-api";
import { DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw, Search, Wallet, TrendingUp } from "lucide-react";

type FundTab = "vaults" | "transactions";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DEPOSIT:        { label: "充值", color: "text-emerald-400" },
  WITHDRAW:       { label: "提现", color: "text-red-400" },
  COMMISSION:     { label: "佣金", color: "text-blue-400" },
  NODE_PURCHASE:  { label: "购节点", color: "text-amber-400" },
  REWARD:         { label: "奖励",  color: "text-purple-400" },
  TRANSFER:       { label: "转账", color: "text-white/60" },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  PENDING:   "text-amber-400  bg-amber-400/10  border-amber-400/20",
  CLOSED:    "text-white/40   bg-white/5        border-white/10",
  FAILED:    "text-red-400    bg-red-400/10    border-red-400/20",
};

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtNum(n?: number | string, dec = 2) {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function AdminFunds() {
  requireAdmin();
  const [tab, setTab] = useState<FundTab>("vaults");
  const [txPage, setTxPage] = useState(1);
  const [txSearch, setTxSearch] = useState("");
  const [txType, setTxType] = useState("");
  const PAGE_SIZE = 20;

  const { data: vaults = [], isLoading: vaultLoading, refetch: refetchVaults } = useQuery<any[]>({
    queryKey: ["/api/admin/vault-deposits"],
    queryFn: () => adminGetVaultDeposits(100),
  });

  const { data: txData, isLoading: txLoading, refetch: refetchTx } = useQuery<{ txs: any[]; total: number }>({
    queryKey: ["/api/admin/transactions", txPage, txType, txSearch],
    queryFn: () => adminGetTransactions(txPage, PAGE_SIZE, txType || undefined, txSearch || undefined),
  });

  const txs = txData?.txs || [];
  const txTotal = txData?.total || 0;
  const txPages = Math.ceil(txTotal / PAGE_SIZE);

  // Vault stats
  const activeVaults = vaults.filter((v: any) => v.status === "ACTIVE");
  const totalTvl = activeVaults.reduce((s, v) => s + Number(v.principal || 0), 0);
  const totalInterest = vaults.reduce((s, v) => s + Number(v.interestRate || 0), 0) / Math.max(vaults.length, 1);

  const TAB_BTN = (t: FundTab, label: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? "bg-blue-600 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`;

  const TH = "px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-white/30 font-medium";
  const TD = "px-3 py-3 text-sm text-white/70 border-t border-white/5";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-400" />资金管理
          </h1>
          <p className="text-xs text-white/40 mt-0.5">查看金库存款和系统资金流水</p>
        </div>
        <button onClick={() => tab === "vaults" ? refetchVaults() : refetchTx()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all">
          <RefreshCw className="h-3.5 w-3.5" />刷新
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "总存款记录", value: String(vaults.length), icon: Wallet, color: "text-blue-400" },
          { label: "活跃金库", value: String(activeVaults.length), icon: TrendingUp, color: "text-emerald-400" },
          { label: "TVL (USDT)", value: `$${fmtNum(totalTvl)}`, icon: DollarSign, color: "text-amber-400" },
          { label: "平均利率", value: `${fmtNum(totalInterest * 100, 1)}%`, icon: ArrowUpRight, color: "text-purple-400" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">{k.label}</span>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button className={TAB_BTN("vaults", "金库存款")} onClick={() => setTab("vaults")}>金库存款</button>
        <button className={TAB_BTN("transactions", "资金流水")} onClick={() => setTab("transactions")}>资金流水</button>
      </div>

      {/* Vault Deposits Tab */}
      {tab === "vaults" && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/[0.03]">
              <tr>
                {["钱包地址", "本金(USDT)", "利率", "方案", "状态", "到期日"].map(h => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vaultLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-white/30 text-sm">加载中...</td></tr>
              ) : vaults.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <Wallet className="h-8 w-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30">暂无金库存款记录</p>
                </td></tr>
              ) : vaults.map((v: any) => (
                <tr key={v.id} className="hover:bg-white/[0.015] transition-colors">
                  <td className={TD}>
                    <span className="font-mono text-xs text-blue-300">{shortAddr(v.walletAddress)}</span>
                  </td>
                  <td className={`${TD} font-mono font-semibold text-emerald-400`}>
                    ${fmtNum(v.principal)}
                  </td>
                  <td className={`${TD} font-mono`}>
                    {v.interestRate ? `${(Number(v.interestRate) * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className={TD}>{(v.planType || v.planIndex) ?? "—"}</td>
                  <td className={TD}>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATUS_BADGE[v.status] || STATUS_BADGE.CLOSED}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className={`${TD} text-white/40 text-xs`}>{fmtDate(v.maturityDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === "transactions" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                className="pl-8 pr-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400 w-52"
                placeholder="搜索钱包/TxHash..." value={txSearch}
                onChange={e => { setTxSearch(e.target.value); setTxPage(1); }}
              />
            </div>
            <select
              className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400"
              value={txType} onChange={e => { setTxType(e.target.value); setTxPage(1); }}
            >
              <option value="">全部类型</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["钱包地址", "类型", "金额", "Token", "状态", "TxHash", "时间"].map(h => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-white/30 text-sm">加载中...</td></tr>
                ) : txs.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <ArrowUpRight className="h-8 w-8 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/30">暂无资金流水记录</p>
                  </td></tr>
                ) : txs.map((tx: any) => {
                  const typeInfo = TYPE_LABELS[tx.type] || { label: tx.type, color: "text-white/60" };
                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className={TD}>
                        <span className="font-mono text-xs text-blue-300">{shortAddr(tx.walletAddress)}</span>
                      </td>
                      <td className={TD}>
                        <span className={`text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className={`${TD} font-mono font-semibold`}>
                        <span className={Number(tx.amount) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(tx.amount) >= 0 ? "+" : ""}{fmtNum(tx.amount)}
                        </span>
                      </td>
                      <td className={`${TD} text-white/50 text-xs`}>{tx.token || "USDT"}</td>
                      <td className={TD}>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATUS_BADGE[tx.status] || STATUS_BADGE.CLOSED}`}>
                          {tx.status || "—"}
                        </span>
                      </td>
                      <td className={`${TD} font-mono text-xs text-white/30`}>
                        {tx.txHash ? `${tx.txHash.slice(0, 8)}…` : "—"}
                      </td>
                      <td className={`${TD} text-white/40 text-xs`}>{fmtDate(tx.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {txPages > 1 && (
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>共 {txTotal} 条 · 第 {txPage}/{txPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 transition-all flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3" />上一页
                </button>
                <button onClick={() => setTxPage(p => Math.min(txPages, p + 1))} disabled={txPage >= txPages}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 transition-all flex items-center gap-1">
                  下一页<ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
