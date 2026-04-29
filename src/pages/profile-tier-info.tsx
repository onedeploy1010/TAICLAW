import { ArrowLeft, Info } from "lucide-react";
import { useLocation } from "wouter";

const AMBER = "hsl(43,74%,58%)";

const LEVELS = [
  { v: "V1", holding: "1,000U",  team: "2万U",    refs: 2,  teamReward: "4%",  sameRank: "—",      special: "—" },
  { v: "V2", holding: "1,000U",  team: "5万U",    refs: 3,  teamReward: "8%",  sameRank: "—",      special: "—" },
  { v: "V3", holding: "1,000U",  team: "30万U",   refs: 5,  teamReward: "12%", sameRank: "平级1%", special: "—" },
  { v: "V4", holding: "2,000U",  team: "100万U",  refs: 7,  teamReward: "16%", sameRank: "平级1%", special: "—" },
  { v: "V5", holding: "3,000U",  team: "300万U",  refs: 10, teamReward: "20%", sameRank: "平级1%", special: "—" },
  { v: "V6", holding: "4,000U",  team: "700万U",  refs: 13, teamReward: "23%", sameRank: "平级1%", special: "上级沉淀分红" },
  { v: "V7", holding: "5,000U",  team: "2,000万U",refs: 15, teamReward: "25%", sameRank: "平级1%", special: "上级沉淀分红" },
  { v: "V8", holding: "10,000U", team: "5,000万U",refs: 15, teamReward: "27%", sameRank: "平级5%", special: "—" },
  { v: "V9", holding: "20,000U", team: "9,000万U",refs: 15, teamReward: "29%", sameRank: "平级1%", special: "同级沉淀5%+DAO权" },
];

export default function ProfileTierInfoPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen pb-24" style={{ background: "#080808" }}>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #1a1408 0%, #0e0b05 60%, #080808 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(212,168,50,0.1) 0%, transparent 60%)" }} />
        <div className="relative px-4 pt-3 pb-5">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => navigate("/profile/referral")}
              className="w-9 h-9 flex items-center justify-center rounded-full shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ArrowLeft className="h-5 w-5 text-white/90" />
            </button>
            <h1 className="text-[17px] font-bold text-white">推广等级 & 奖励说明</h1>
          </div>

          {/* Top KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "rgba(212,168,50,0.07)", border: "1px solid rgba(212,168,50,0.2)" }}>
              <div className="text-[10px] text-white/40 mb-1">直推收益（固定）</div>
              <div className="text-[28px] font-black" style={{ color: AMBER }}>5%</div>
              <div className="text-[9px] text-white/30 mt-1">每笔直推节点奖励固定 5%</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div className="text-[10px] text-white/40 mb-1">团队收益区间</div>
              <div className="text-[28px] font-black text-indigo-400">4–29%</div>
              <div className="text-[9px] text-white/30 mt-1">V1 至 V9 按等级递增</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Info note */}
        <div className="flex gap-2 rounded-xl p-3" style={{ background: "rgba(212,168,50,0.05)", border: "1px solid rgba(212,168,50,0.12)" }}>
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: AMBER }} />
          <p className="text-[10px] text-white/45 leading-relaxed">
            达到对应 V 级需同时满足：<span style={{ color: AMBER }}>持仓要求</span>、<span style={{ color: AMBER }}>团队业绩</span> 及 <span style={{ color: AMBER }}>直推布道人数</span>。平级收益从 V3 起生效。
          </p>
        </div>

        {/* V-level cards */}
        {LEVELS.map((lvl, i) => {
          const pct = (i + 1) / LEVELS.length;
          const hue = 220 + pct * 60;
          const accent = `hsl(${hue},80%,65%)`;
          return (
            <div key={lvl.v} className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid hsla(${hue},60%,50%,0.2)`, background: `hsla(${hue},30%,10%,0.4)` }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: `hsla(${hue},40%,12%,0.6)`, borderBottom: `1px solid hsla(${hue},50%,40%,0.15)` }}>
                <span className="text-[15px] font-black" style={{ color: accent }}>{lvl.v}</span>
                <span className="text-[13px] font-black" style={{ color: accent }}>{lvl.teamReward} 团队奖励</span>
              </div>
              {/* Card body */}
              <div className="grid grid-cols-3 gap-0 px-4 py-3">
                {[
                  { label: "持仓要求", value: lvl.holding },
                  { label: "团队业绩", value: lvl.team },
                  { label: "直推人数", value: `${lvl.refs}人` },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-[9px] text-white/30 mb-1">{item.label}</div>
                    <div className="text-[12px] font-bold text-white/80">{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Special rights */}
              {(lvl.sameRank !== "—" || lvl.special !== "—") && (
                <div className="flex gap-2 px-4 pb-3 flex-wrap">
                  {lvl.sameRank !== "—" && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `hsla(${hue},60%,50%,0.12)`, border: `1px solid hsla(${hue},60%,50%,0.25)`, color: accent }}>
                      {lvl.sameRank}
                    </span>
                  )}
                  {lvl.special !== "—" && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "rgba(212,168,50,0.1)", border: "1px solid rgba(212,168,50,0.25)", color: AMBER }}>
                      {lvl.special}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer note */}
        <div className="text-center text-[9px] text-white/20 pb-2">
          ※ 平级收益 1%（V3 及以上）· 数据来源：RUNE+ 模型制度
        </div>
      </div>
    </div>
  );
}
