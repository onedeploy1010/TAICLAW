import { useState } from "react";
import { Lock, Flame, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuneLockSection } from "@/components/vault/rune-lock-section";
import { EmberBurnSection } from "@/components/vault/ember-burn-section";
import { useTranslation } from "react-i18next";

type VaultTab = "lock" | "burn";

const TABS: Array<{
  key: VaultTab;
  icon: React.ElementType;
  labelKey: string;
  labelDefault: string;
  descKey: string;
  descDefault: string;
  accent: string;
  gradient: string;
}> = [
  {
    key: "lock",
    icon: Lock,
    labelKey: "vault.tabLock",
    labelDefault: "RUNE Lock",
    descKey: "vault.tabLockDesc",
    descDefault: "Earn veRUNE · AI dividends · IDO access",
    accent: "rgba(212,168,50,0.9)",
    gradient: "linear-gradient(135deg, rgba(212,168,50,0.18), rgba(180,130,30,0.08))",
  },
  {
    key: "burn",
    icon: Flame,
    labelKey: "vault.tabBurn",
    labelDefault: "Burn → EMBER",
    descKey: "vault.tabBurnDesc",
    descDefault: "Permanent yield · 1.0–1.5% daily EMBER",
    accent: "rgba(239,68,68,0.9)",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.05))",
  },
];

export default function Vault() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<VaultTab>("lock");
  const active = TABS.find(t => t.key === activeTab) || TABS[0];

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
          <h2 className="text-base font-bold tracking-tight">{t("vault.pageTitle", "RUNE Vault")}</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("vault.pageSubtitle", "Lock or burn RUNE for long-term protocol benefits")}</p>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="px-4 lg:px-6 pt-4 pb-1">
        <div className="grid grid-cols-2 gap-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-all",
                  isActive ? "ring-1" : "opacity-55 hover:opacity-80"
                )}
                style={isActive ? {
                  background: tab.gradient,
                  border: `1px solid ${tab.accent}30`,
                } : {
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                data-testid={`tab-vault-${tab.key}`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                    style={isActive ? { background: `${tab.accent}20`, border: `1px solid ${tab.accent}30` } : { background: "rgba(255,255,255,0.06)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={isActive ? { color: tab.accent } : { color: "rgba(255,255,255,0.4)" }} />
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={isActive ? { color: tab.accent } : { color: "rgba(255,255,255,0.5)" }}
                  >
                    {t(tab.labelKey, tab.labelDefault)}
                  </span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto" style={{ color: tab.accent }} />}
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed pl-7.5">
                  {t(tab.descKey, tab.descDefault)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 lg:mx-6 mt-4 mb-0" style={{ borderTop: `1px solid ${active.accent}20` }} />

      {/* ── Tab Content ── */}
      <div key={activeTab} className="vault-fade pt-4 space-y-4">
        {activeTab === "lock" ? <RuneLockSection /> : <EmberBurnSection />}
      </div>
    </div>
  );
}
