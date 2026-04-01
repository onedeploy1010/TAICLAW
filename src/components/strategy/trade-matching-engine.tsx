/**
 * Trade Matching Engine — Shows trading pair matching signals
 * Simulates a matching engine scanning pairs and generating trade signals
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Zap, ArrowRightLeft, TrendingUp, TrendingDown, Minus, Radio } from "lucide-react";

interface MatchSignal {
  id: string;
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  strategy: string;
  model: string;
  leverage: number;
  strength: "STRONG" | "MEDIUM" | "WEAK";
  timestamp: number;
}

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "DOGE/USDT", "XRP/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "DOT/USDT"];
const STRAT_TYPES = ["trend_following", "mean_reversion", "breakout", "scalping", "momentum", "swing"];
const MODELS = ["GPT-4o", "Claude", "Gemini", "DeepSeek", "Llama"];

function generateSignal(): MatchSignal {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const dirs: ("LONG" | "SHORT" | "NEUTRAL")[] = ["LONG", "LONG", "SHORT", "NEUTRAL"];
  const direction = dirs[Math.floor(Math.random() * dirs.length)];
  const strengths: ("STRONG" | "MEDIUM" | "WEAK")[] = ["STRONG", "MEDIUM", "MEDIUM", "WEAK"];
  return {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pair,
    direction,
    confidence: 55 + Math.floor(Math.random() * 35),
    strategy: STRAT_TYPES[Math.floor(Math.random() * STRAT_TYPES.length)],
    model: MODELS[Math.floor(Math.random() * MODELS.length)],
    leverage: [2, 3, 5, 8, 10][Math.floor(Math.random() * 5)],
    strength: strengths[Math.floor(Math.random() * strengths.length)],
    timestamp: Date.now(),
  };
}

export function TradeMatchingEngine() {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [signals, setSignals] = useState<MatchSignal[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [pairsScanned, setPairsScanned] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startScan = () => {
    setIsScanning(true);
    setSignals([]);
    setScanProgress(0);
    setPairsScanned(0);
  };

  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setPairsScanned(prev => {
        const next = prev + 1;
        setScanProgress(Math.min((next / PAIRS.length) * 100, 100));

        if (Math.random() > 0.35) {
          const sig = generateSignal();
          setSignals(prev => [sig, ...prev].slice(0, 20));
        }

        if (next >= PAIRS.length) {
          clearInterval(interval);
          setTimeout(() => setIsScanning(false), 800);
        }
        return next;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [isScanning]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [signals]);

  const strengthColor = (s: string) => s === "STRONG" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25" : s === "MEDIUM" ? "text-yellow-400 bg-yellow-500/15 border-yellow-500/25" : "text-muted-foreground bg-muted/30 border-border";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(212,168,50,0.1)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,168,50,0.15)", border: "1px solid rgba(212,168,50,0.25)" }}>
            <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-foreground/90">Trade Matching Engine</div>
            <div className="text-[9px] text-muted-foreground">{PAIRS.length} pairs · {MODELS.length} models · {STRAT_TYPES.length} strategies</div>
          </div>
        </div>
        <button
          onClick={startScan}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-[0.97]"
          style={{
            background: isScanning ? "rgba(212,168,50,0.1)" : "linear-gradient(135deg, rgba(212,168,50,0.25), rgba(212,168,50,0.12))",
            border: "1px solid rgba(212,168,50,0.3)",
            color: isScanning ? "rgba(212,168,50,0.5)" : "hsl(43,74%,52%)",
          }}
        >
          {isScanning ? (
            <><Radio className="h-3 w-3 animate-pulse" /> Scanning...</>
          ) : (
            <><Zap className="h-3 w-3" /> Scan Pairs</>
          )}
        </button>
      </div>

      {/* Scan Progress */}
      {isScanning && (
        <div className="px-3 py-2" style={{ background: "rgba(212,168,50,0.03)" }}>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Scanning {PAIRS[Math.min(pairsScanned, PAIRS.length - 1)]}...</span>
            <span>{pairsScanned}/{PAIRS.length} pairs</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${scanProgress}%`, background: "hsl(43,74%,52%)" }} />
          </div>
        </div>
      )}

      {/* Signal List */}
      <div ref={scrollRef} className="max-h-[260px] overflow-y-auto scrollbar-hide">
        {signals.length === 0 && !isScanning ? (
          <div className="py-8 text-center">
            <ArrowRightLeft className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/40">Click "Scan Pairs" to start matching</p>
          </div>
        ) : (
          signals.map((sig, i) => (
            <div key={sig.id}
              className="flex items-center gap-2 px-3 py-2 transition-all"
              style={{
                borderBottom: i < signals.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                background: i === 0 && isScanning ? "rgba(212,168,50,0.04)" : "transparent",
                animation: i === 0 ? "fadeSlideIn 0.3s ease-out" : undefined,
              }}
            >
              {/* Direction */}
              <span className={`inline-flex items-center gap-0.5 font-bold rounded text-[10px] px-1.5 py-0.5 shrink-0 ${
                sig.direction === "LONG" ? "text-emerald-400 bg-emerald-500/10" :
                sig.direction === "SHORT" ? "text-red-400 bg-red-500/10" :
                "text-foreground/40 bg-white/[0.05]"
              }`}>
                {sig.direction === "LONG" ? <TrendingUp className="h-2.5 w-2.5" /> :
                 sig.direction === "SHORT" ? <TrendingDown className="h-2.5 w-2.5" /> :
                 <Minus className="h-2.5 w-2.5" />}
                {sig.direction}
              </span>

              {/* Pair */}
              <span className="text-[11px] font-bold text-foreground/80 w-[70px] shrink-0">{sig.pair}</span>

              {/* Meta */}
              <span className="text-[9px] text-muted-foreground/40 flex-1 truncate">
                {sig.model} · {sig.strategy.replace(/_/g, " ")} · {sig.leverage}x
              </span>

              {/* Confidence */}
              <span className="text-[10px] font-bold tabular-nums shrink-0" style={{
                color: sig.confidence >= 70 ? "#4ade80" : sig.confidence >= 55 ? "hsl(43,74%,52%)" : "#f87171",
              }}>
                {sig.confidence}%
              </span>

              {/* Strength Badge */}
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${strengthColor(sig.strength)}`}>
                {sig.strength}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      {signals.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground/50" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <span>{signals.length} signals matched</span>
          <span>{signals.filter(s => s.strength === "STRONG").length} strong · {signals.filter(s => s.direction === "LONG").length} long · {signals.filter(s => s.direction === "SHORT").length} short</span>
        </div>
      )}
    </div>
  );
}
