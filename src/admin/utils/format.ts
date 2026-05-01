/**
 * Admin number formatting utilities — banking/financial style.
 *
 * All monetary values use thousand separators, fixed decimals,
 * and currency prefixes/suffixes as appropriate.
 */

// ── Full-precision formatters (for tables and detail views) ──

/** Format as USD with $ prefix: $1,234.56 */
export function formatUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "\u2014";
  if (n === 0) return "$0.00";
  if (n < 0) {
    return `($${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format MA tokeån amount: 1,234.5678 MA (2-4 decimals) */
export function formatMA(n: number | null | undefined, decimals: 2 | 4 = 2): string {
  if (n == null || isNaN(n)) return "\u2014";
  if (n === 0) return "0.00 MA";
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: decimals })} MA`;
}

/** Format a plain number with commas: 1,234.56 (no currency prefix/suffix) */
export function formatNum(n: number | null | undefined, minDec = 2, maxDec = 4): string {
  if (n == null || isNaN(n)) return "\u2014";
  if (n === 0) return "0".padEnd(2 + minDec, minDec > 0 ? "0" : "");
  return n.toLocaleString("en-US", { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}

/** Format a percentage: 12.34% */
export function formatPercent(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "\u2014";
  return `${n.toFixed(decimals)}%`;
}

// ── Compact formatters (for stat cards / hero cards) ──
// Always show full number with commas, never abbreviate with K/M/B

/** Compact number — full with commas: 1,234,567.89 */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "\u2014";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compact USD for stat cards: $1,234,567.89 */
export function formatCompactUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "\u2014";
  return formatUSD(n);
}

/** Compact MA for stat cards: 1,234,567.89 MA */
export function formatCompactMA(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "\u2014";
  return formatMA(n);
}

// ── Table cell helpers ──

/**
 * Render a number for table cells — returns the dash character for zero/null values
 * to keep tables clean. Uses full precision with commas.
 */
export function cellMA(n: number | null | undefined, decimals: 2 | 4 = 2): string {
  if (n == null || isNaN(n) || Math.abs(n) < 0.01) return "\u2014";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

/** Like cellMA but with USD prefix */
export function cellUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n) || Math.abs(n) < 0.01) return "\u2014";
  if (n < 0) {
    return `($${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── CSS class name constant ──
/** Tailwind class string for numeric table cells */
export const NUM_CELL = "font-[JetBrains_Mono,IBM_Plex_Mono,monospace] tabular-nums text-right tracking-tight";

/** Tailwind class string for numeric cells without right-align (e.g., in stat cards) */
export const NUM_DISPLAY = "font-[JetBrains_Mono,IBM_Plex_Mono,monospace] tabular-nums tracking-tight";
