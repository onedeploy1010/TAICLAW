import { useState } from "react";
import { Lock, Flame, Shield, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuneLockSection } from "@/components/vault/rune-lock-section";
import { EmberBurnSection } from "@/components/vault/ember-burn-section";
import { VaultLpPool } from "@/components/vault/vault-lp-pool";
import { VaultCharts } from "@/components/vault/vault-charts";
import { useTranslation } from "react-i18next";

type VaultTab = "pool" | "lock" | "burn";

const TABS: Array<{
  key: VaultTab;
  icon: React.ElementType;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  accent: string;
  gradient: string;
}> = [
  {
    key: "pool",
    icon: BarChart2,
    labelZh: "金库",
    labelEn: "Vault",
    descZh: "底池沉淀 · 交易资金",
    descEn: "LP Pools · Trading Fund",
    accent: "rgba(59,130,246,0.9)",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.08))",
  },
  {
    key: "lock",
    icon: Lock,
    labelZh: "锁仓",
    labelEn: "Lock",
    descZh: "锁仓RUNE · 获得veRUNE",
    descEn: "Lock RUNE · Earn veRUNE",
    accent: "rgba(212,168,50,0.9)",
    gradient: "linear-gradient(135deg, rgba(212,168,50,0.18), rgba(180,130,30,0.08))",
  },
  {
    key: "burn",
    icon: Flame,
    labelZh: "销毁",
    labelEn: "Burn",
    descZh: "永久销毁 · 每日EMBER",
    descEn: "Burn RUNE · Daily EMBER",
    accent: "rgba(239,68,68,0.9)",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.05))",
  },
];

export default function Vault() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";
  const [activeTab, setActiveTab] = useState<VaultTab>("pool");
  const active = TABS.find(tab => tab.key === activeTab) || TABS[0];

  return (
    <div className="pb-24 lg:pb-8">
      <style>{`
        @keyframes vaultFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vault-fade { animation: vaultFadeIn 0.22s ease-out both; }
      `}</style>

      {/* ── Page Header ── */}
      <div className="px-4 lg:px-6 pt-4 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2 mb-0.5">
          <Shield className="h-4 w-4" style={{ color: "rgba(212,168,50,0.7)" }} />
          <h2 className="text-base font-bold tracking-tight">
            {isZh ? "符库" : "VAULT"}
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isZh ? "锁仓 · 销毁 · 底池沉淀" : "Lock · Burn · LP Accumulation"}
        </p>
      </div>

      {/* ── 3 Sub-tabs ── */}
      <div className="px-4 lg:px-6 pt-4 pb-1">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-all",
                  isActive ? "" : "opacity-50 hover:opacity-75"
                )}
                style={isActive ? {
                  background: tab.gradient,
                  border: `1px solid ${tab.accent}35`,
                } : {
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                data-testid={`tab-vault-${tab.key}`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute top-0 left-4 right-4 h-[1.5px] rounded-full"
                    style={{ background: tab.accent, opacity: 0.8 }} />
                )}
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                  style={isActive
                    ? { background: `${tab.accent}20`, border: `1px solid ${tab.accent}35` }
                    : { background: "rgba(255,255,255,0.06)" }}
                >
                  <Icon className="h-3.5 w-3.5"
                    style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.35)" }} />
                </div>
                <span className="text-[11px] font-bold mt-1"
                  style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.45)" }}>
                  {isZh ? tab.labelZh : tab.labelEn}
                </span>
                <p className="text-[8.5px] text-muted-foreground leading-snug">
                  {isZh ? tab.descZh : tab.descEn}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 lg:mx-6 mt-3 mb-0"
        style={{ borderTop: `1px solid ${active.accent}20` }} />

      {/* ── Tab Content ── */}
      <div key={activeTab} className="vault-fade pt-4 space-y-4">
        {activeTab === "pool" && (
          <div className="space-y-4 pb-4">
            <VaultLpPool />
            <VaultCharts />
          </div>
        )}
        {activeTab === "lock" && <RuneLockSection />}
        {activeTab === "burn" && <EmberBurnSection />}
      </div>
    </div>
  );
}
