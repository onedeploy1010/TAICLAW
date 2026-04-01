/**
 * AI Thinking Console — Continuous AI conversation with auto-generated analysis
 * Opens as a dialog, generates new analysis lines continuously
 */
import { useState, useEffect, useRef, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, X, Brain } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ThinkingLine {
  type: "system" | "analysis" | "signal" | "result";
  text: string;
}

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "LINK", "DOT"];
const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D"];

function ts() {
  const n = new Date();
  return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}:${n.getSeconds().toString().padStart(2, "0")}`;
}
function rng(min: number, max: number) { return +(min + Math.random() * (max - min)).toFixed(2); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateBlock(model: string, t: (k: string, o?: any) => string): ThinkingLine[] {
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
  const confidence = Math.floor(rng(52, 88));
  const isBullish = (emaAligned && rsiVal < 70 && bidAsk > 1.0) || confidence > 70;
  const targetPct = rng(0.8, 5.2);

  const lines: ThinkingLine[] = [
    { type: "system", text: `[${timestamp}] ${model} ${t("aiConsole.loadingMarket", { pair })}` },
    { type: "analysis", text: `> ${t("aiConsole.fetchCandles", { tf, count: Math.floor(rng(100, 300)) })}` },
  ];

  const indicators = [
    () => ({ type: "analysis" as const, text: `> ${emaAligned ? t("aiConsole.emaBullish") : t("aiConsole.emaCompute")}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.rsiMomentum", { val: rsiVal.toFixed(1) })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.volumeAbove", { pct: volumePct.toString() })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.orderBook", { ratio: bidAsk.toFixed(2) })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.fearGreed", { val: fgIndex.toString(), label: fgLabel })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.fundingRate", { rate: rng(-0.03, 0.05).toFixed(3) })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.macdExpand")}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.ichimoku")}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.bbSqueeze")}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.adxStrong", { val: Math.floor(rng(18, 45)).toString() })}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.obvAccum")}` }),
    () => ({ type: "analysis" as const, text: `> ${t("aiConsole.relVolume", { val: rng(0.8, 2.5).toFixed(1) })}` }),
  ];

  const shuffled = indicators.sort(() => Math.random() - 0.5);
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count && i < shuffled.length; i++) lines.push(shuffled[i]());

  lines.push({ type: "signal", text: `> ${t("aiConsole.multiScore", { score: rng(4, 9).toFixed(1) })}` });
  lines.push({
    type: "result",
    text: isBullish
      ? `✓ ${t("aiConsole.consensusBull", { conf: confidence.toString(), target: targetPct.toFixed(1) })}`
      : `✓ ${t("aiConsole.consensusBear", { conf: confidence.toString() })}`,
  });

  return lines;
}

// ─── Main Console Component ───────────────────────────────────────────────────

export function AiThinkingConsole({ model, color, isVisible }: { model: string; color: string; isVisible: boolean }) {
  const { t } = useTranslation();
  const [displayedLines, setDisplayedLines] = useState<ThinkingLine[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [currentType, setCurrentType] = useState<string>("system");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      cancelRef.current = true;
      setDisplayedLines([]);
      setCurrentText("");
      setIsTyping(false);
      return;
    }

    cancelRef.current = false;
    setDisplayedLines([]);
    setCurrentText("");

    let isMounted = true;

    async function typeLines(lines: ThinkingLine[]) {
      for (const line of lines) {
        if (cancelRef.current || !isMounted) return;
        setCurrentType(line.type);
        // Type character by character
        for (let i = 0; i <= line.text.length; i++) {
          if (cancelRef.current || !isMounted) return;
          setCurrentText(line.text.slice(0, i));
          const speed = line.type === "system" ? 12 : line.type === "result" ? 20 : 15;
          await new Promise(r => setTimeout(r, speed));
        }
        // Line complete — add to displayed
        setDisplayedLines(prev => [...prev.slice(-60), line]);
        setCurrentText("");
        const pause = line.type === "result" ? 800 : line.type === "signal" ? 400 : 80;
        await new Promise(r => setTimeout(r, pause));
      }
    }

    async function loop() {
      setIsTyping(true);
      while (!cancelRef.current && isMounted) {
        const block = generateBlock(model, t);
        await typeLines(block);
        if (cancelRef.current || !isMounted) break;
        // Pause between blocks
        await new Promise(r => setTimeout(r, 2500));
      }
      setIsTyping(false);
    }

    loop();

    return () => {
      isMounted = false;
      cancelRef.current = true;
    };
  }, [isVisible, model, t]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayedLines, currentText]);

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
        {isTyping && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        <span className="text-[9px] font-mono text-muted-foreground/40">{isTyping ? t("aiConsole.analyzing") : t("aiConsole.done")}</span>
      </div>
      <div ref={scrollRef} className="px-3 py-2 h-[240px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 scrollbar-hide">
        {displayedLines.map((line, i) => (
          <div key={i} className={lineColor(line.type)}>{line.text}</div>
        ))}
        {currentText && (
          <div className={lineColor(currentType)}>
            {currentText}<span className="animate-pulse" style={{ color }}>▊</span>
          </div>
        )}
        {displayedLines.length === 0 && !currentText && (
          <div className="text-muted-foreground/30 animate-pulse">Initializing {model}...</div>
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
        style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${color}25`, color }}
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
