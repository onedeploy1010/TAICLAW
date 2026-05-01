import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requireAdmin } from "@/admin/admin-auth";
import { adminGetContractConfigs, adminUpdateContractConfig, adminAddLog } from "@/admin/admin-api";
import { FileCode2, Pencil, Check, X, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContractConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedBy?: string;
  updatedAt?: string;
  createdAt: string;
}

export default function AdminContracts() {
  const { username } = requireAdmin();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [search, setSearch] = useState("");

  const { data: configs = [], isLoading, refetch } = useQuery<ContractConfig[]>({
    queryKey: ["/api/admin/contract-configs"],
    queryFn: adminGetContractConfigs,
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      adminUpdateContractConfig(key, value, username),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/contract-configs"] });
      adminAddLog(username, "UPDATE_CONTRACT_CONFIG", `Updated: ${key}`);
      toast({ title: "已更新", description: `${key} 已保存` });
      setEditingKey(null);
    },
    onError: () => toast({ title: "更新失败", variant: "destructive" }),
  });

  const createConfig = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    try {
      const token = sessionStorage.getItem("qa_admin_token");
      const r = await fetch("/api/admin/contract-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: newKey.trim(), value: newValue.trim(), description: newDesc.trim(), createdBy: username }),
      });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["/api/admin/contract-configs"] });
      adminAddLog(username, "CREATE_CONTRACT_CONFIG", `Created: ${newKey}`);
      toast({ title: "已添加", description: `${newKey} 配置已创建` });
      setAddMode(false); setNewKey(""); setNewValue(""); setNewDesc("");
    } catch { toast({ title: "添加失败", variant: "destructive" }); }
  };

  const filtered = configs.filter(c =>
    !search || c.key.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const INPUT = "bg-black/40 border border-blue-500/30 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-400 placeholder:text-white/25";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-blue-400" />合约配置
          </h1>
          <p className="text-xs text-white/40 mt-0.5">管理合约地址和系统关键参数 · 共 {configs.length} 条</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all">
            <RefreshCw className="h-3.5 w-3.5" />刷新
          </button>
          <button onClick={() => { setAddMode(v => !v); setEditingKey(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white font-medium bg-blue-600 hover:bg-blue-500 transition-all">
            <Plus className="h-3.5 w-3.5" />新增
          </button>
        </div>
      </div>

      {addMode && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">新增配置项</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 mb-1 block">配置键 Key</label>
              <input className={INPUT} value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="NODE_CONTRACT_ADDRESS" />
            </div>
            <div>
              <label className="text-[11px] text-white/40 mb-1 block">配置值 Value</label>
              <input className={INPUT} value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="0x..." />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">描述（可选）</label>
            <input className={INPUT} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="此配置的用途说明" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setAddMode(false)} className="px-4 py-1.5 rounded-lg text-xs text-white/60 border border-white/10 hover:border-white/20">取消</button>
            <button onClick={createConfig} disabled={!newKey.trim() || !newValue.trim()}
              className="px-4 py-1.5 rounded-lg text-xs text-white font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40">保存</button>
          </div>
        </div>
      )}

      <input className="w-full sm:w-72 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400"
        placeholder="搜索配置键或描述..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="hidden sm:grid grid-cols-[180px_1fr_120px_80px] px-4 py-2.5 bg-white/[0.03] border-b border-white/8 text-[10px] uppercase tracking-widest text-white/30">
          <span>配置键</span><span>配置值</span><span>更新时间</span><span className="text-right">操作</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/30 text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileCode2 className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">{search ? "无匹配结果" : "暂无合约配置"}</p>
            {!search && <p className="text-xs text-white/20 mt-1">点击「新增」添加合约地址或系统参数</p>}
          </div>
        ) : filtered.map(cfg => (
          <div key={cfg.key} className="flex flex-col sm:grid sm:grid-cols-[180px_1fr_120px_80px] items-start sm:items-center gap-2 px-4 py-3.5 border-b border-white/5 hover:bg-white/[0.015] transition-colors">
            <div className="min-w-0">
              <span className="text-[11px] px-2 py-0.5 rounded font-mono border border-blue-500/25 bg-blue-500/10 text-blue-300 break-all">{cfg.key}</span>
              {cfg.description && <p className="text-[10px] text-white/30 mt-1">{cfg.description}</p>}
            </div>

            <div className="flex-1 min-w-0 w-full">
              {editingKey === cfg.key ? (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-black/50 border border-blue-400/50 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none min-w-0"
                    value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === "Enter") updateMut.mutate({ key: editingKey, value: editValue }); if (e.key === "Escape") setEditingKey(null); }}
                  />
                  <button onClick={() => updateMut.mutate({ key: editingKey, value: editValue })} disabled={updateMut.isPending}
                    className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingKey(null)} className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-sm font-mono text-white/70 break-all">
                  {cfg.value || <span className="text-white/25 italic">（空）</span>}
                </p>
              )}
            </div>

            <div className="text-[10px] text-white/30">
              {cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleDateString("zh-CN") : "—"}
              {cfg.updatedBy && <span className="block text-white/20">{cfg.updatedBy}</span>}
            </div>

            <div className="flex justify-end w-full sm:w-auto">
              {editingKey !== cfg.key && (
                <button onClick={() => { setEditingKey(cfg.key); setEditValue(cfg.value); setAddMode(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-blue-400 border border-blue-500/20 hover:border-blue-400/40 hover:bg-blue-500/10 transition-all">
                  <Pencil className="h-3 w-3" />编辑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && configs.length > filtered.length && (
        <p className="text-xs text-white/20 text-right">{filtered.length} / {configs.length} 条</p>
      )}
    </div>
  );
}
