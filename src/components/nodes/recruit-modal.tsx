import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ShieldCheck, ArrowRight, Users, Percent, AlertCircle } from "lucide-react";

const TIERS = [
  {
    key: "FOUNDER",
    nameCn: "联创",
    nameEn: "FOUNDER NODE",
    rgb: "192, 132, 252",
    color: "text-purple-300",
    price: 50000,
    directPct: 15,
    airdrop: 75000,
    lv: 5,
    seats: 20,
    genesis: false,
  },
  {
    key: "SUPER",
    nameCn: "超级",
    nameEn: "SUPER NODE",
    rgb: "251, 191, 36",
    color: "text-amber-300",
    price: 10000,
    directPct: 12,
    airdrop: 13000,
    lv: 4,
    seats: 200,
    genesis: false,
  },
  {
    key: "ADVANCED",
    nameCn: "高级",
    nameEn: "ADVANCED NODE",
    rgb: "52, 211, 153",
    color: "text-emerald-300",
    price: 5000,
    directPct: 10,
    airdrop: 6250,
    lv: 3,
    seats: 400,
    genesis: false,
  },
  {
    key: "STANDARD",
    nameCn: "中级",
    nameEn: "STANDARD NODE",
    rgb: "96, 165, 250",
    color: "text-blue-300",
    price: 2500,
    directPct: 8,
    airdrop: 3000,
    lv: 2,
    seats: 800,
    genesis: false,
  },
  {
    key: "BASIC",
    nameCn: "初级",
    nameEn: "BASIC NODE",
    rgb: "148, 163, 184",
    color: "text-slate-300",
    price: 1000,
    directPct: 5,
    airdrop: 1000,
    lv: 1,
    seats: 1000,
    genesis: false,
  },
  {
    key: "GENESIS",
    nameCn: "创世",
    nameEn: "GENESIS NODE",
    rgb: "217, 70, 239",
    color: "text-fuchsia-300",
    price: 0,
    directPct: 0,
    airdrop: 0,
    lv: 6,
    seats: 0,
    genesis: true,
  },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectTier: (tierKey: string) => void;
}

export function RecruitModal({ open, onClose, onSelectTier }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleBuy() {
    if (!selected) return;
    onClose();
    onSelectTier(selected);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(null); onClose(); } }}>
      <DialogContent className="max-w-sm max-h-[88dvh] overflow-y-auto p-0 gap-0 overflow-hidden border border-white/10"
        style={{ background: "#07101f" }}>

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 shrink-0">
              <LayoutGrid className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <DialogTitle className="text-sm font-bold text-white leading-tight">
              节点招募 · Node Recruitment
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-white/40 leading-snug pl-[42px]">
            选择档位，支付 USDT 即刻激活节点席位
          </DialogDescription>
        </div>

        {/* Tier list */}
        <div className="flex flex-col gap-1.5 px-4 py-4">
          {TIERS.map((tier) => {
            const isActive = selected === tier.key;
            return (
              <button
                key={tier.key}
                type="button"
                disabled={tier.genesis}
                onClick={() => setSelected(tier.key)}
                className="relative flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-all duration-150 text-left overflow-hidden disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  borderColor: isActive ? `rgb(${tier.rgb})` : "rgba(255,255,255,0.08)",
                  background: isActive ? `rgba(${tier.rgb}, 0.07)` : "rgba(255,255,255,0.02)",
                  boxShadow: isActive ? `0 0 18px rgba(${tier.rgb}, 0.2)` : "none",
                }}
              >
                {/* Left accent stripe */}
                <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                  style={{ background: `rgb(${tier.rgb})`, opacity: isActive ? 1 : 0.35 }} />

                {/* Icon */}
                <span
                  className="ml-0.5 h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-base font-bold"
                  style={{
                    background: `rgba(${tier.rgb}, 0.14)`,
                    color: `rgb(${tier.rgb})`,
                    border: `1px solid rgba(${tier.rgb}, 0.28)`,
                    boxShadow: isActive ? `0 0 10px rgba(${tier.rgb}, 0.3)` : "none",
                  }}
                >
                  {tier.nameCn.charAt(tier.nameCn.length - 1)}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-bold text-white">{tier.nameCn}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-[0.16em] ${tier.color}`}>
                      {tier.nameEn.replace(" NODE", "")}
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-white/25 border border-white/10 rounded px-1 py-0.5">
                      LV.{tier.lv}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/35">
                    {tier.genesis ? (
                      <span className="text-fuchsia-400/80">直推 3 联创 · 资格触发</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          <span className="text-white/60 font-medium">{tier.seats.toLocaleString()}</span> 席
                        </span>
                        <span className="text-white/15">·</span>
                        <span className="flex items-center gap-0.5">
                          <Percent className="h-2.5 w-2.5" />
                          返佣 <span className="font-semibold" style={{ color: `rgb(${tier.rgb})` }}>{tier.directPct}%</span>
                        </span>
                        <span className="text-white/15">·</span>
                        <span>
                          空投 <span className="font-semibold text-white/60">
                            {tier.airdrop >= 1000 ? `${(tier.airdrop / 1000).toFixed(0)}K` : tier.airdrop}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="shrink-0 text-right">
                  {tier.genesis ? (
                    <div className="text-[11px] font-semibold text-fuchsia-400/70">资格制</div>
                  ) : (
                    <>
                      <div className="text-base font-bold tabular-nums"
                        style={{ color: isActive ? `rgb(${tier.rgb})` : "rgba(255,255,255,0.8)" }}>
                        {tier.price.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-white/20 font-mono uppercase tracking-[0.18em]">USDT</div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="px-4 pb-5 space-y-3">
          {!selected && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/25 px-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>请先选择节点档位</span>
            </div>
          )}
          <div className="flex gap-2.5">
            <Button
              variant="ghost"
              onClick={() => { setSelected(null); onClose(); }}
              className="w-20 h-11 text-sm border border-white/10 hover:bg-white/5 text-white/50 hover:text-white/80"
            >
              稍后
            </Button>
            <Button
              className="flex-1 h-11 font-semibold gap-2 text-sm text-black disabled:opacity-40 disabled:shadow-none transition-all"
              style={selected ? {
                background: `rgb(${TIERS.find(t => t.key === selected)?.rgb ?? "251,191,36"})`,
                boxShadow: `0 0 20px rgba(${TIERS.find(t => t.key === selected)?.rgb ?? "251,191,36"}, 0.4)`,
              } : { background: "rgba(251,191,36,0.5)" }}
              disabled={!selected}
              onClick={handleBuy}
            >
              <ShieldCheck className="h-4 w-4" />
              立即购买
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
