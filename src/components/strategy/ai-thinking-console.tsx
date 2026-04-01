/**
 * AI Thinking Console — Continuous AI conversation with auto-generated analysis
 * Opens as a dialog, generates new analysis lines continuously (non-hardcoded)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, X, Brain } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ThinkingLine {
  type: "system" | "analysis" | "signal" | "result" | "thinking";
  text: string;
  ts: string;
}

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "LINK", "DOT"];
const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D"];

function ts() {
  const n = new Date();
  return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}:${n.getSeconds().toString().padStart(2, "0")}`;
}

function rng(min: number, max: number) { return +(min + Math.random() * (max - min)).toFixed(2); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateAnalysisBlock(model: string, t: (k: string, o?: any) => string): ThinkingLine[] {
  const asset = pick(ASSETS);
  const tf = pick(TIMEFRAMES);
  const pair = `${asset}/USDT`;
  const timestamp = ts();

  const rsiVal = rng(25, 82);
  const emaAligned = Math.random() > 0.35;
  const volumePct = Math.floor(rng(8, 65));
  const bidAsk = rng(0.75, 1.65);
  const fgIndex = Math.floor(rng(15, 85));
  const fgLabel = fgIndex < 25 ? "Fear" : fgIndex < 45 ? "Neutral" : fgIndex < 75 ? "Greed" : "Extreme Greed";
  const fundRate = rng(-0.03, 0.05);
  const confidence = Math.floor(rng(52, 88));
  const isBullish = (emaAligned && rsiVal < 70 && bidAsk > 1.0) || confidence > 70;
  const targetPct = rng(0.8, 5.2);

  const lines: ThinkingLine[] = [
    { type: "system", text: `[${timestamp}] ${model} ${t("aiConsole.loadingMarket", { pair })}`, ts: timestamp },
    { type: "analysis", text: `> ${t("aiConsole.fetchCandles", { tf, count: Math.floor(rng(100, 300)) })}`, ts: timestamp },
  ];

  // Dynamically pick 3-5 random indicators
  const indicators = [
    () => ({ type: "analysis" as const, text: `> ${emaAligned ? t("aiConsole.emaBullish") : t("aiConsole.emaCompute")}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.rsiMomentum", { val: rsiVal.toFixed(1) })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.volumeAbove", { pct: volumePct.toString() })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.orderBook", { ratio: bidAsk.toFixed(2) })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.fearGreed", { val: fgIndex.toString(), label: fgLabel })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.fundingRate", { rate: fundRate.toFixed(3) })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.macdExpand")}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.ichimoku")}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.bbSqueeze")}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.adxStrong", { val: Math.floor(rng(18, 45)).toString() })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.obvAccum")}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.microstructure", { ratio: rng(0.4, 0.7).toFixed(2) })}`, ts: timestamp }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.relVolume", { val: rng(0.8, 2.5).toFixed(1) })}`, ts: timestamp }),
  ];

  // Shuffle and pick 3-5
  const shuffled = indicators.sort(() => Math.random() - 0.5);
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count && i < shuffled.length; i++) {
    lines.push(shuffled[i]());
  }

  const score = rng(4, 9);
  lines.push({ type: "signal", text: `> ${t("aiConsole.multiScore", { score: score.toFixed(1) })}`, ts: timestamp });

  if (isBullish) {
    lines.push({ type: "result", text: `✓ ${t("aiConsole.consensusBull", { conf: confidence.toString(), target: targetPct.toFixed(1) })}`, ts: timestamp });
  } else {
    lines.push({ type: "result", text: `✓ ${t("aiConsole.consensusBear", { conf: confidence.toString() })}`, ts: timestamp });
  }

  // Add a short pause before next cycle
  lines.push({ type: "thinking", text: "", ts: timestamp });

  return lines;
}

export function AiThinkingConsole({ model, color, isVisible }: { model: string; color: string; isVisible: boolean }) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<ThinkingLine[]>([]);
  const [typingLine, setTypingLine] = useState<ThinkingLine | null>(null);
  const [charIdx, setCharIdx] = useState(0);
  const queueRef = useRef<ThinkingLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  const enqueueBlock = useCallback(() => {
    const block = generateAnalysisBlock(model, t);
    queueRef.current.push(...block);
  }, [model, t]);

  // Start/stop based on visibility
  useEffect(() => {
    if (isVisible) {
      activeRef.current = true;
      setLines([]);
      queueRef.current = [];
      enqueueBlock();
    } else {
      activeRef.current = false;
      setTypingLine(null);
      setCharIdx(0);
    }
  }, [isVisible, enqueueBlock]);

  // Process queue — type out one line at a time
  useEffect(() => {
    if (!activeRef.current) return;

    if (!typingLine) {
      // Get next from queue
      if (queueRef.current.length === 0) {
        // Generate a new block after a pause
        const timer = setTimeout(() => {
          if (activeRef.current) enqueueBlock();
        }, 2000);
        return () => clearTimeout(timer);
      }
      const next = queueRef.current.shift()!;
      if (next.type === "thinking") {
        // Pause between blocks
        const timer = setTimeout(() => {
          if (activeRef.current && queueRef.current.length === 0) enqueueBlock();
        }, 3000);
        return () => clearTimeout(timer);
      }
      setTypingLine(next);
      setCharIdx(0);
      return;
    }

    // Type characters
    if (charIdx < typingLine.text.length) {
      const speed = typingLine.type === "system" ? 12 : typingLine.type === "result" ? 20 : 15;
      const timer = setTimeout(() => setCharIdx(c => c + 1), speed);
      return () => clearTimeout(timer);
    } else {
      // Line complete
      const delay = typingLine.type === "result" ? 800 : typingLine.type === "signal" ? 500 : 100;
      const timer = setTimeout(() => {
        setLines(prev => [...prev.slice(-50), typingLine!]); // Keep max 50 lines
        setTypingLine(null);
        setCharIdx(0);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [typingLine, charIdx, enqueueBlock]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, charIdx]);

  const lineColor = (type: string) =>
    type === "system" ? "text-muted-foreground/50" :
    type === "signal" ? "text-yellow-400/80" :
    type === "result" ? "text-emerald-400 font-bold" :
    "text-foreground/55";

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${color}15` }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "rgba(0,0,0,0.3)", borderBottom: `1px solid ${color}10` }}>
        <Terminal className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{model} {t("aiConsole.console")}</span>
        <div className="flex-1" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono text-muted-foreground/40">{t("aiConsole.analyzing")}</span>
      </div>
      <div ref={scrollRef} className="px-3 py-2 h-[220px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 scrollbar-hide">
        {lines.map((line, i) => (
          <div key={i} className={lineColor(line.type)}>{line.text}</div>
        ))}
        {typingLine && (
          <div className={lineColor(typingLine.type)}>
            {typingLine.text.slice(0, charIdx)}<span className="animate-pulse" style={{ color }}>▊</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Button + Dialog wrapper ──────────────────────────────────────────────────

export function AiConsoleButton({ model, color }: { model: string; color: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${color}25`,
          color: color,
        }}
      >
        <Brain className="h-3.5 w-3.5" />
        {t("aiConsole.console")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-md w-full p-0 overflow-hidden"
          style={{
            background: "linear-gradient(160deg, hsl(22,20%,4%), hsl(20,15%,3%))",
            border: `1px solid ${color}22`,
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" style={{ color }} />
              <span className="text-sm font-bold">{model} {t("aiConsole.console")}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AiThinkingConsole model={model} color={color} isVisible={open} />
        </DialogContent>
      </Dialog>
    </>
  );
}
