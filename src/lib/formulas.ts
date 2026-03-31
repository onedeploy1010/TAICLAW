import type { VaultChartPeriod } from "./data";

export interface VaultChartPoint {
  day: number;
  value: number;
}

export interface VaultChartConfig {
  points: number;
  baseValue: number;
  dailyGrowth: number;
  noise: number;
  boostAfter?: number;
  boostRate?: number;
}

const VAULT_CHART_CONFIGS: Record<VaultChartPeriod, VaultChartConfig> = {
  "7D":  { points: 7,  baseValue: 420000, dailyGrowth: 1800, noise: 2000 },
  "14D": { points: 14, baseValue: 410000, dailyGrowth: 1600, noise: 3000 },
  "30D": { points: 30, baseValue: 400000, dailyGrowth: 1100, noise: 4000 },
  "ALL": { points: 60, baseValue: 380000, dailyGrowth: 900,  noise: 5000, boostAfter: 40, boostRate: 1500 },
};

export function generateVaultChartData(period: VaultChartPeriod): VaultChartPoint[] {
  const cfg = VAULT_CHART_CONFIGS[period];
  return Array.from({ length: cfg.points }, (_, i) => {
    let value = cfg.baseValue + i * cfg.dailyGrowth + Math.random() * cfg.noise;
    if (cfg.boostAfter && cfg.boostRate && i > cfg.boostAfter) {
      value += i * cfg.boostRate;
    }
    return { day: i + 1, value };
  });
}

export interface StrategyChartPoint {
  v: number;
}

export function generateStrategyChartData(index: number, points: number = 20): StrategyChartPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    v: 50 + Math.sin((i + index * 7) / 3) * 20 + Math.random() * 10 + (i > 12 ? i * 2 : 0),
  }));
}

export interface PredictionCell {
  direction: "up" | "down";
  hit: boolean;
}

export function generatePredictionCells(
  totalCells: number,
  directionThreshold: number,
  hitThreshold: number,
): PredictionCell[] {
  return Array.from({ length: totalCells }, () => ({
    direction: Math.random() > directionThreshold ? "up" : "down",
    hit: Math.random() > hitThreshold,
  }));
}

export function calcWinRate(wins: number, total: number): string {
  if (total === 0) return "0.0";
  return ((wins / total) * 100).toFixed(1);
}

export function calcVaultDailyYield(principal: number, dailyRate: number): number {
  return principal * dailyRate;
}

export function calcVaultTotalYield(principal: number, dailyRate: number, days: number): number {
  return principal * dailyRate * days;
}

export function calcVaultAPR(dailyRate: number): string {
  return (dailyRate * 365 * 100).toFixed(1) + "%";
}

export function calcPayout(stake: number, payoutPercent: number): number {
  return stake * (1 + payoutPercent / 100);
}

export function calcStrategyReturn(monthlyReturn: number): { formatted: string; isPositive: boolean } {
  const isPositive = monthlyReturn >= 0;
  return {
    formatted: `${isPositive ? "+" : ""}${monthlyReturn.toFixed(2)}%`,
    isPositive,
  };
}

export function calcStrategyWinDisplay(winRate: number): string {
  return `${winRate.toFixed(2)}% (${(winRate / 10).toFixed(2)})`;
}

export function getReturnColor(isPositive: boolean): string {
  return isPositive ? "hsl(160, 70%, 45%)" : "hsl(0, 72%, 55%)";
}

export function formatDailyRate(dailyRate: number): string {
  return (dailyRate * 100).toFixed(1) + "%";
}

export function formatPercent(value: number, decimals: number = 2): string {
  return value.toFixed(decimals) + "%";
}
