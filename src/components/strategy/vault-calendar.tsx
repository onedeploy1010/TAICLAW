import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getCalendarDays } from "./strategy-header";

function getCumulativeStats(timeSeed = 0) {
  const now = new Date();
  const dataStart = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  let totalPnl = 0; let wins = 0; let losses = 0;
  for (let m = 0; m < 9; m++) {
    const mDate = new Date(dataStart.getFullYear(), dataStart.getMonth() + m, 1);
    const days = getCalendarDays(mDate, timeSeed);
    for (const cell of days) {
      if (cell.day === 0 || cell.pnl === 0) continue;
      totalPnl += cell.pnl;
      if (cell.pnl > 0) wins++; else losses++;
    }
  }
  return { totalPnl, wins, losses };
}

export function VaultCalendar() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh" || i18n.language === "zh-TW";
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [timeSeed, setTimeSeed] = useState(() => Math.floor(Date.now() / 30000));

  useEffect(() => {
    const timer = setInterval(() => setTimeSeed(Math.floor(Date.now() / 30000)), 30000);
    return () => clearInterval(timer);
  }, []);

  const calendarDays = getCalendarDays(calendarMonth, timeSeed);
  const stats = getCumulativeStats(timeSeed);

  const MONTH_NAMES_ZH = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabel = isZh
    ? `${calendarMonth.getFullYear()}年 ${MONTH_NAMES_ZH[calendarMonth.getMonth()]}`
    : `${MONTH_NAMES_EN[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;

  const weekDays = isZh
    ? ["日","一","二","三","四","五","六"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const activeDays = calendarDays.filter(c => c.day > 0 && c.pnl !== 0);
  const mWins   = activeDays.filter(c => c.pnl > 0).length;
  const mLosses = activeDays.filter(c => c.pnl < 0).length;
  const mPnl    = activeDays.reduce((s, c) => s + c.pnl, 0);
  const mWinRate = activeDays.length > 0 ? (mWins / activeDays.length * 100) : 0;
  const hasData  = mWins + mLosses > 0;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(212,168,50,0.15)", background: "rgba(212,168,50,0.03)" }}>

      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/5"
        data-testid="button-vault-calendar-toggle"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-amber-400/80" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
            {isZh ? "AI 量化 · 日收益日历" : "AI Quant · Daily P&L Calendar"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span className={`text-[10px] font-bold tabular-nums ${mPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {mPnl >= 0 ? "+" : ""}{mPnl.toFixed(1)}%
            </span>
          )}
          <span className="text-muted-foreground text-[10px]">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }`}</style>

          {/* Monthly mini-stats */}
          {hasData && (
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                { label: isZh ? "月化" : "Monthly", val: `${mPnl >= 0 ? "+" : ""}${mPnl.toFixed(1)}%`, color: mPnl >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: isZh ? "胜率" : "Win Rate", val: `${mWinRate.toFixed(0)}%`, color: "text-foreground" },
                { label: isZh ? "盈利天" : "Wins", val: String(mWins), color: "text-emerald-400" },
                { label: isZh ? "亏损天" : "Losses", val: String(mLosses), color: "text-red-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-lg py-1.5 px-1"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className={`text-[12px] font-bold tabular-nums ${color}`}>{val}</div>
                  <div className="text-[8.5px] text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              data-testid="button-vault-cal-prev">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-bold">{monthLabel}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              data-testid="button-vault-cal-next">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekDays.map(d => (
              <div key={d} className="text-[9px] text-muted-foreground font-semibold py-0.5">{d}</div>
            ))}
            {calendarDays.map((cell, idx) => (
              <div key={idx}
                className={`rounded py-0.5 text-center ${cell.day === 0 ? "" : "border border-white/5"}`}
                style={cell.day > 0 ? {
                  background: cell.pnl > 0
                    ? `rgba(52,211,153,${Math.min(0.08 + Math.abs(cell.pnl) * 0.025, 0.28)})`
                    : cell.pnl < 0
                    ? `rgba(248,113,113,${Math.min(0.06 + Math.abs(cell.pnl) * 0.02, 0.22)})`
                    : "rgba(255,255,255,0.03)"
                } : {}}>
                {cell.day > 0 && (
                  <>
                    <div className="text-[9px] font-semibold leading-tight text-foreground/70">{cell.day}</div>
                    <div className={`text-[8px] font-medium leading-tight ${
                      cell.pnl > 0 ? "text-emerald-400" : cell.pnl < 0 ? "text-red-400" : "text-muted-foreground/40"
                    }`}>
                      {cell.pnl !== 0 ? `${cell.pnl > 0 ? "+" : ""}${cell.pnl.toFixed(1)}` : "--"}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Monthly total bar */}
          {hasData && (
            <div className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-[10px] text-muted-foreground">{isZh ? "本月累计" : "Month total"}</span>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold tabular-nums ${mPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {mPnl >= 0 ? "+" : ""}{mPnl.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <span className="text-emerald-400 font-medium">{mWins}W</span>{" / "}
                  <span className="text-red-400 font-medium">{mLosses}L</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
