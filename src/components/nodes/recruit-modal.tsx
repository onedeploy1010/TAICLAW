import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ShieldCheck, ArrowRight, Users, AlertCircle } from "lucide-react";

const TIERS = [
  {
    key: "SMALL",
    nameCn: "小节点",
    nameEn: "SMALL NODE",
    rgb: "96, 165, 250",
    color: "text-blue-300",
    price: 1000,
    seats: 1000,
  },
  {
    key: "BIG",
    nameCn: "大节点",
    nameEn: "BIG NODE",
    rgb: "59, 130, 246",
    color: "text-blue-400",
    price: 10000,
    seats: 200,
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 shrink-0">
              <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />
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
                onClick={() => setSelected(tier.key)}
                className="relative flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-all duration-150 text-left overflow-hidden"
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
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/35">
                    <span className="flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      <span className="text-white/60 font-medium">{tier.seats.toLocaleString()}</span> 席
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="shrink-0 text-right">
                  <div className="text-base font-bold tabular-nums"
                    style={{ color: isActive ? `rgb(${tier.rgb})` : "rgba(255,255,255,0.8)" }}>
                    {tier.price.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-white/20 font-mono uppercase tracking-[0.18em]">USDT</div>
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
              className="flex-1 h-11 font-semibold gap-2 text-sm text-white disabled:opacity-40 disabled:shadow-none transition-all"
              style={selected ? {
                background: `rgb(${TIERS.find(t => t.key === selected)?.rgb ?? "59,130,246"})`,
                boxShadow: `0 0 20px rgba(${TIERS.find(t => t.key === selected)?.rgb ?? "59,130,246"}, 0.4)`,
              } : { background: "rgba(59,130,246,0.5)" }}
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
