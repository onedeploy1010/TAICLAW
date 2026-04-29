import { useTranslation } from "react-i18next";

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function getHourlyValue(min: number, max: number, salt: number) {
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  return min + seededRandom(hourSeed + salt) * (max - min);
}

function useHourlyValue(min: number, max: number, salt: number) {
  const [value, setValue] = useState(() => getHourlyValue(min, max, salt));
  useEffect(() => {
    const interval = setInterval(() => {
      setValue(getHourlyValue(min, max, salt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [min, max, salt]);
  return value;
}

export function getCalendarDays(calendarMonth: Date, timeSeed = 0) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { day: number; pnl: number }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, pnl: 0 });

  const now = new Date();
  const dataStartDate = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  const isHistorical = new Date(year, month, 1) >= dataStartDate && new Date(year, month, 1) <= now;

  if (!isHistorical) {
    for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, pnl: 0 });
    return days;
  }

  const monthSeed = year * 100 + (month + 1);
  const monthRng = ((Math.sin(monthSeed * 4729 + 17389) % 1) + 1) % 1;
  const targetMonthly = 28 + monthRng * 17;

  const rawPnls: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date > now) { rawPnls.push(0); continue; }

    const daysAgo = Math.floor((now.getTime() - date.getTime()) / 86400000);
    // Recent 5 days fluctuate with timeSeed; older days are stable
    const tf = daysAgo <= 5 ? timeSeed * (d + 3) : 0;
    const seed = year * 10000 + (month + 1) * 100 + d + tf;
    const rng = ((Math.sin(seed * 9301 + 49297) % 1) + 1) % 1;
    const rng2 = ((Math.sin(seed * 7919 + 31337) % 1) + 1) % 1;
    const rng3 = ((Math.sin(seed * 6271 + 15731) % 1) + 1) % 1;
    const winThreshold = daysAgo > 7 ? 0.30 : 0.25 + (rng3 * 0.1);
    const isWin = rng > winThreshold;
    let pnl: number;
    if (isWin) {
      pnl = 0.8 + rng2 * 2.4;
      if (daysAgo <= 3) pnl *= (0.9 + rng3 * 0.4);
    } else {
      pnl = -(0.3 + rng3 * 1.7);
      if (daysAgo <= 3) pnl *= (0.8 + rng2 * 0.3);
    }
    const dow = date.getDay();
    if (dow === 0 || dow === 6) pnl *= 0.4;

    // Today fluctuates with hour progress
    if (date.toDateString() === now.toDateString()) {
      const hourProgress = (now.getHours() * 60 + now.getMinutes()) / 1440;
      const jitter = ((Math.sin(timeSeed * 1337) % 1) + 1) % 1;
      pnl *= (0.3 + hourProgress * 0.7) * (0.85 + jitter * 0.3);
    }

    rawPnls.push(pnl);
  }

  const rawTotal = rawPnls.reduce((s, v) => s + v, 0);
  const scale = rawTotal > 0 ? targetMonthly / rawTotal : 1;

  for (let d = 1; d <= daysInMonth; d++) {
    const scaled = rawPnls[d - 1] * scale;
    days.push({ day: d, pnl: Math.round(scaled * 100) / 100 });
  }
  return days;
}

function getCumulativeStats(timeSeed = 0) {
  const now = new Date();
  const dataStart = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
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

export function StrategyHeader() {
  const { t } = useTranslation();
  return (
    <div className="px-4 pt-4 pb-2" style={{ animation: "fadeSlideIn 0.4s ease-out" }}>
      <h2 className="text-lg font-bold" data-testid="text-strategy-title">{t("strategy.aiStrategies")}</h2>
    </div>
  );
}
