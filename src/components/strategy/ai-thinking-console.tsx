/**
 * AI Thinking Console — Terminal-style streaming text showing model reasoning process
 * Simulates real-time AI analysis with typewriter effect
 */
import { useState, useEffect, useRef } from "react";
import { Terminal, Cpu, Zap } from "lucide-react";

interface ThinkingLine {
  type: "system" | "analysis" | "signal" | "result";
  text: string;
}

function getThinkingLines(model: string, asset?: string): ThinkingLine[] {
  const a = asset || "BTC";
  const now = new Date();
  const ts = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

  const lines: Record<string, ThinkingLine[]> = {
    "GPT-4o": [
      { type: "system", text: `[${ts}] GPT-4o engine initializing...` },
      { type: "system", text: `[${ts}] Loading market context for ${a}/USDT` },
      { type: "analysis", text: `> Fetching 4H candles... 200 bars loaded` },
      { type: "analysis", text: `> Computing EMA(9,21,55) crossover states` },
      { type: "analysis", text: `> EMA9 > EMA21 > EMA55 — bullish alignment detected` },
      { type: "analysis", text: `> RSI(14) = 62.4 — momentum zone, not overbought` },
      { type: "analysis", text: `> MACD histogram expanding — acceleration confirmed` },
      { type: "analysis", text: `> Volume profile: +34% above 20-day avg` },
      { type: "analysis", text: `> Checking order book depth... bid/ask ratio 1.38` },
      { type: "analysis", text: `> Fear & Greed Index: 68 (Greed)` },
      { type: "analysis", text: `> Funding rate: +0.012% — moderate long bias` },
      { type: "signal", text: `> Multi-factor score: 7.2/10 — STRONG signal` },
      { type: "result", text: `✓ Consensus: BULLISH | Confidence: 76% | Target: +3.2%` },
    ],
    "Claude": [
      { type: "system", text: `[${ts}] Claude risk engine starting...` },
      { type: "system", text: `[${ts}] Contrarian analysis mode for ${a}/USDT` },
      { type: "analysis", text: `> Scanning market sentiment indicators...` },
      { type: "analysis", text: `> Twitter sentiment: 72% bullish — potential crowding` },
      { type: "analysis", text: `> Open interest delta: +$420M (24h) — overleveraged` },
      { type: "analysis", text: `> Liquidation heatmap: dense cluster at $-2.1%` },
      { type: "analysis", text: `> Historical pattern match: 83% similarity to Feb reversal` },
      { type: "analysis", text: `> Bollinger Band: price at upper band (2.1σ)` },
      { type: "analysis", text: `> Divergence check: RSI bearish divergence forming` },
      { type: "analysis", text: `> Risk assessment: elevated downside probability` },
      { type: "signal", text: `> Contrarian signal: CAUTION — mean reversion likely` },
      { type: "result", text: `✓ Consensus: BEARISH | Confidence: 64% | Risk: HIGH` },
    ],
    "Gemini": [
      { type: "system", text: `[${ts}] Gemini multi-frame scanner active` },
      { type: "system", text: `[${ts}] Volatility analysis for ${a}/USDT` },
      { type: "analysis", text: `> 5m ATR: 0.18% | 1H ATR: 0.92% | 4H ATR: 2.1%` },
      { type: "analysis", text: `> Implied vol (options): 48.2% — elevated` },
      { type: "analysis", text: `> Bollinger squeeze detected on 15m timeframe` },
      { type: "analysis", text: `> Keltner channel breakout imminent (1H)` },
      { type: "analysis", text: `> Volume spike detector: 3 spikes in last 2H` },
      { type: "analysis", text: `> Microstructure: taker buy ratio 0.61 — aggressive buying` },
      { type: "analysis", text: `> Cross-exchange flow: Binance → Bybit arb detected` },
      { type: "signal", text: `> Scalp opportunity: breakout imminent` },
      { type: "result", text: `✓ Consensus: BULLISH | Confidence: 71% | Timeframe: 15m` },
    ],
    "DeepSeek": [
      { type: "system", text: `[${ts}] DeepSeek technical engine loaded` },
      { type: "system", text: `[${ts}] Pure TA scan for ${a}/USDT` },
      { type: "analysis", text: `> Ichimoku: price above cloud, Tenkan > Kijun` },
      { type: "analysis", text: `> Stochastic RSI: %K(78) crossing below %D(81)` },
      { type: "analysis", text: `> ADX(14) = 32 — strong trend confirmed` },
      { type: "analysis", text: `> Fibonacci retracement: held 0.618 level ($XX,XXX)` },
      { type: "analysis", text: `> VWAP: price +1.2% above session VWAP` },
      { type: "analysis", text: `> OBV divergence: accumulation phase detected` },
      { type: "analysis", text: `> Pivot points: R1 = +1.8%, S1 = -1.3%` },
      { type: "signal", text: `> Technical consensus: 8/11 indicators BULLISH` },
      { type: "result", text: `✓ Consensus: BULLISH | Confidence: 74% | R/R: 1.38` },
    ],
    "Llama": [
      { type: "system", text: `[${ts}] Llama local inference starting...` },
      { type: "system", text: `[${ts}] Momentum scan for ${a}/USDT` },
      { type: "analysis", text: `> Rate of Change (10): +4.2% — accelerating` },
      { type: "analysis", text: `> CMF(20): 0.18 — positive money flow` },
      { type: "analysis", text: `> Williams %R: -22 — near overbought territory` },
      { type: "analysis", text: `> CCI(20): 142 — strong upward momentum` },
      { type: "analysis", text: `> Momentum oscillator: positive divergence` },
      { type: "analysis", text: `> Relative volume: 1.8x average` },
      { type: "analysis", text: `> Price action: higher highs, higher lows (3 swings)` },
      { type: "signal", text: `> Momentum score: 72/100 — entry zone active` },
      { type: "result", text: `✓ Consensus: BULLISH | Confidence: 68% | Momentum: HIGH` },
    ],
  };

  return lines[model] || lines["GPT-4o"];
}

export function AiThinkingConsole({ model, color, isVisible }: { model: string; color: string; isVisible: boolean }) {
  const [displayedLines, setDisplayedLines] = useState<ThinkingLine[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [currentCharIdx, setCurrentCharIdx] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useRef(getThinkingLines(model)).current;

  useEffect(() => {
    if (!isVisible) {
      setDisplayedLines([]);
      setCurrentLineIdx(0);
      setCurrentCharIdx(0);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedLines([]);
    setCurrentLineIdx(0);
    setCurrentCharIdx(0);
  }, [isVisible]);

  useEffect(() => {
    if (!isTyping || currentLineIdx >= lines.length) {
      if (currentLineIdx >= lines.length) setIsTyping(false);
      return;
    }

    const line = lines[currentLineIdx];
    const speed = line.type === "system" ? 15 : line.type === "result" ? 25 : 18;

    if (currentCharIdx < line.text.length) {
      const timer = setTimeout(() => setCurrentCharIdx(c => c + 1), speed);
      return () => clearTimeout(timer);
    } else {
      const delay = line.type === "result" ? 600 : line.type === "signal" ? 400 : 120;
      const timer = setTimeout(() => {
        setDisplayedLines(prev => [...prev, line]);
        setCurrentLineIdx(i => i + 1);
        setCurrentCharIdx(0);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isTyping, currentLineIdx, currentCharIdx, lines]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLines, currentCharIdx]);

  const currentLine = currentLineIdx < lines.length ? lines[currentLineIdx] : null;
  const partialText = currentLine ? currentLine.text.slice(0, currentCharIdx) : "";

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${color}15` }}>
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "rgba(0,0,0,0.3)", borderBottom: `1px solid ${color}10` }}>
        <Terminal className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{model} Console</span>
        <div className="flex-1" />
        {isTyping && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        <span className="text-[9px] font-mono text-muted-foreground/40">{isTyping ? "analyzing..." : "done"}</span>
      </div>

      {/* Console Body */}
      <div ref={scrollRef} className="px-3 py-2 max-h-[200px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 scrollbar-hide">
        {displayedLines.map((line, i) => (
          <div key={i} className={
            line.type === "system" ? "text-muted-foreground/50" :
            line.type === "signal" ? "text-yellow-400/80" :
            line.type === "result" ? "text-emerald-400 font-bold" :
            "text-foreground/55"
          }>
            {line.text}
          </div>
        ))}
        {currentLine && (
          <div className={
            currentLine.type === "system" ? "text-muted-foreground/50" :
            currentLine.type === "signal" ? "text-yellow-400/80" :
            currentLine.type === "result" ? "text-emerald-400 font-bold" :
            "text-foreground/55"
          }>
            {partialText}<span className="animate-pulse" style={{ color }}>▊</span>
          </div>
        )}
      </div>
    </div>
  );
}
