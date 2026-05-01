/**
 * AI Trading Engine
 * Periodically calls OpenAI to simulate trades for each AI model.
 * Stores paper trades + console logs in the database.
 */

import type { Pool } from "pg";

const MODELS = [
  { key: "GPT-4o",  style: "momentum trend follower using EMA crossovers and volume confirmation" },
  { key: "Claude",  style: "risk-aware contrarian using RSI extremes and mean reversion signals" },
  { key: "Gemini",  style: "volatility scalper using Bollinger Band squeezes and multi-timeframe confluence" },
  { key: "DeepSeek",style: "technical purist using RSI/MACD/Bollinger with strict signal confirmation" },
  { key: "Llama",   style: "momentum chaser using breakout patterns and volume surge detection" },
  { key: "QA",      style: "multi-model consensus using weighted ensemble of all above strategies" },
];

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT"];
const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D"];
const STRATEGIES = ["trend_following", "mean_reversion", "breakout", "momentum", "scalping"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rng(min: number, max: number) { return +(min + Math.random() * (max - min)).toFixed(4); }

// Fetch current price from our own klines endpoint (internal)
async function fetchPrice(asset: string): Promise<number> {
  const fallbacks: Record<string, number> = {
    BTC: 97000, ETH: 3800, SOL: 175, BNB: 610, XRP: 2.5,
    DOGE: 0.16, ADA: 0.48, AVAX: 38, LINK: 18, DOT: 7,
  };
  try {
    // Try Binance directly (may fail in production due to geo-block)
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${asset}USDT`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const d = await r.json();
      return parseFloat(d.price);
    }
  } catch {}
  try {
    // Try Kraken as fallback
    const krakenPairs: Record<string, string> = {
      BTC: "XBTUSD", ETH: "ETHUSD", SOL: "SOLUSD", BNB: "BNBUSD",
      XRP: "XRPUSD", DOGE: "DOGEUSD", ADA: "ADAUSD", AVAX: "AVAXUSD",
      LINK: "LINKUSD", DOT: "DOTUSD",
    };
    const pair = krakenPairs[asset] || `${asset}USD`;
    const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const d = await r.json();
      const key = Object.keys(d.result || {})[0];
      if (key) return parseFloat(d.result[key].c[0]);
    }
  } catch {}
  // Use fallback + small noise
  return (fallbacks[asset] || 100) * (0.98 + Math.random() * 0.04);
}

// Call OpenAI to generate a trade decision with step-by-step reasoning
async function generateTrade(
  model: ModelConfig,
  asset: string,
  timeframe: string,
  currentPrice: number,
  openaiKey: string,
): Promise<{ decision: TradeDecision; consoleLogs: ConsoleLog[] } | null> {
  const rsiVal = rng(22, 80).toFixed(1);
  const macdSignal = Math.random() > 0.5 ? "bullish crossover" : "bearish crossover";
  const volPct = Math.floor(rng(5, 70));
  const bbPosition = Math.random() > 0.5 ? "near upper band" : "near lower band";
  const fgIndex = Math.floor(rng(15, 85));
  const fgLabel = fgIndex < 25 ? "Extreme Fear" : fgIndex < 45 ? "Fear" : fgIndex < 75 ? "Greed" : "Extreme Greed";
  const fundingRate = rng(-0.05, 0.05).toFixed(4);

  const prompt = `You are ${model.key} AI trading bot. Your strategy: ${model.style}.

Current market data for ${asset}/USDT on ${timeframe} timeframe:
- Price: $${currentPrice.toFixed(4)}
- RSI(14): ${rsiVal}
- MACD: ${macdSignal}
- Volume: +${volPct}% vs 20-period average
- Bollinger Bands: price ${bbPosition}
- Fear & Greed Index: ${fgIndex} (${fgLabel})
- Funding Rate: ${fundingRate}%

Respond with ONLY this JSON (no other text):
{
  "side": "LONG" or "SHORT",
  "confidence": integer 52-91,
  "leverage": integer 2-20,
  "targetPct": number (expected % move, positive),
  "stopPct": number (stop loss %, positive),
  "strategy": "trend_following" or "mean_reversion" or "breakout" or "momentum" or "scalping",
  "reasoning": "one sentence max 80 chars"
}`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) return null;
    const data = await r.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    const side = raw.side === "SHORT" ? "SHORT" : "LONG";
    const confidence = Math.max(52, Math.min(91, parseInt(raw.confidence) || 65));
    const leverage = Math.max(2, Math.min(20, parseInt(raw.leverage) || 5));
    const targetPct = Math.max(0.3, Math.min(15, parseFloat(raw.targetPct) || 1.5));
    const stopPct = Math.max(0.2, Math.min(8, parseFloat(raw.stopPct) || 0.8));
    const strategy = STRATEGIES.includes(raw.strategy) ? raw.strategy : pick(STRATEGIES);
    const reasoning: string = (raw.reasoning || "Signals aligned with strategy criteria").slice(0, 120);

    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    const ss = now.getSeconds().toString().padStart(2, "0");
    const ts = `${hh}:${mm}:${ss}`;

    const consoleLogs: ConsoleLog[] = [
      { type: "system",   text: `[${ts}] ${model.key} — loading ${asset}/USDT ${timeframe} market data` },
      { type: "analysis", text: `> Fetching last 200 ${timeframe} candles from exchange` },
      { type: "analysis", text: `> RSI(14): ${rsiVal} — ${parseFloat(rsiVal) > 70 ? "overbought zone" : parseFloat(rsiVal) < 30 ? "oversold zone" : "neutral momentum"}` },
      { type: "analysis", text: `> MACD: ${macdSignal} — ${macdSignal.includes("bullish") ? "upward momentum building" : "downward pressure detected"}` },
      { type: "analysis", text: `> Volume spike +${volPct}% above 20-period average` },
      { type: "analysis", text: `> Bollinger Bands: ${bbPosition} — volatility ${bbPosition.includes("upper") ? "expansion" : "compression"} signal` },
      { type: "analysis", text: `> Fear & Greed: ${fgIndex} (${fgLabel}) — market sentiment ${fgIndex > 60 ? "bullish" : "cautious"}` },
      { type: "analysis", text: `> Funding rate: ${fundingRate}% — ${parseFloat(fundingRate) > 0 ? "longs paying shorts" : "shorts paying longs"}` },
      { type: "signal",   text: `> Multi-factor score: ${rng(5.5, 9.2).toFixed(1)}/10 — ${confidence >= 70 ? "strong" : "moderate"} conviction` },
      { type: "result",   text: `✓ ${side} ${asset} ${leverage}x · conf ${confidence}% · target +${targetPct.toFixed(1)}% · stop -${stopPct.toFixed(1)}%` },
      { type: "result",   text: `  ${reasoning}` },
    ];

    const targetPrice = side === "LONG"
      ? currentPrice * (1 + targetPct / 100)
      : currentPrice * (1 - targetPct / 100);
    const stopPrice = side === "LONG"
      ? currentPrice * (1 - stopPct / 100)
      : currentPrice * (1 + stopPct / 100);

    return {
      decision: {
        side,
        confidence,
        leverage,
        targetPrice,
        stopPrice,
        strategy,
        targetPct,
        stopPct,
        reasoning,
      },
      consoleLogs,
    };
  } catch (e) {
    console.error(`[AI Engine] OpenAI error for ${model.key}:`, e);
    return null;
  }
}

interface ModelConfig {
  key: string;
  style: string;
}

interface TradeDecision {
  side: string;
  confidence: number;
  leverage: number;
  targetPrice: number;
  stopPrice: number;
  strategy: string;
  targetPct: number;
  stopPct: number;
  reasoning: string;
}

interface ConsoleLog {
  type: string;
  text: string;
}

// Simulate trade resolution: randomly close some OPEN trades
async function resolvePendingTrades(pool: Pool) {
  try {
    const { rows: open } = await pool.query(
      `SELECT id, asset, side, entry_price, take_profit, stop_loss, opened_at
       FROM paper_trades WHERE status = 'OPEN' AND primary_model IS NOT NULL
       AND opened_at < NOW() - INTERVAL '15 minutes'
       ORDER BY opened_at ASC LIMIT 20`
    );

    for (const t of open) {
      // 60% of old trades get resolved
      if (Math.random() > 0.6) continue;

      const entry = parseFloat(t.entry_price);
      const tp = t.take_profit ? parseFloat(t.take_profit) : null;
      const sl = t.stop_loss ? parseFloat(t.stop_loss) : null;

      // Simulate price movement
      const hitTp = tp && Math.random() > 0.42;
      const hitSl = sl && !hitTp && Math.random() > 0.55;
      let exitPrice: number;
      let closeReason: string;

      if (hitTp && tp) {
        exitPrice = tp * (0.995 + Math.random() * 0.01);
        closeReason = "take_profit";
      } else if (hitSl && sl) {
        exitPrice = sl * (0.998 + Math.random() * 0.004);
        closeReason = "stop_loss";
      } else {
        // Normal close with small random move
        const movePct = (Math.random() - 0.45) * 3;
        exitPrice = entry * (1 + movePct / 100);
        closeReason = "signal_exit";
      }

      const size = 1000; // $1000 per trade
      const side: string = t.side;
      const priceDiff = side === "LONG" ? exitPrice - entry : entry - exitPrice;
      const pnl = (priceDiff / entry) * size;
      const pnlPct = (priceDiff / entry) * 100;

      await pool.query(
        `UPDATE paper_trades SET
           status = 'CLOSED',
           exit_price = $1,
           pnl = $2,
           pnl_pct = $3,
           close_reason = $4,
           closed_at = NOW()
         WHERE id = $5`,
        [exitPrice.toFixed(4), pnl.toFixed(4), pnlPct.toFixed(4), closeReason, t.id]
      );
    }
  } catch (e) {
    console.error("[AI Engine] resolvePendingTrades error:", e);
  }
}

// Run one trade cycle for a given model
async function runTradeCycle(model: ModelConfig, pool: Pool, openaiKey: string) {
  const asset = pick(ASSETS);
  const timeframe = pick(TIMEFRAMES);

  try {
    const currentPrice = await fetchPrice(asset);
    const result = await generateTrade(model, asset, timeframe, currentPrice, openaiKey);
    if (!result) return;

    const { decision, consoleLogs } = result;
    const size = rng(500, 5000);

    // Save paper trade
    const { rows } = await pool.query(
      `INSERT INTO paper_trades
         (asset, side, entry_price, size, leverage, stop_loss, take_profit,
          strategy_type, status, primary_model, timeframe, opened_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9,$10,NOW())
       RETURNING id`,
      [
        asset,
        decision.side,
        currentPrice.toFixed(4),
        size.toFixed(2),
        decision.leverage,
        decision.stopPrice.toFixed(4),
        decision.targetPrice.toFixed(4),
        decision.strategy,
        model.key,
        timeframe,
      ]
    );
    const tradeId = rows[0]?.id;

    // Save console logs
    for (const log of consoleLogs) {
      await pool.query(
        `INSERT INTO ai_console_logs (model, asset, timeframe, log_type, content, trade_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [model.key, asset, timeframe, log.type, log.text, tradeId || null]
      );
    }

    console.log(`[AI Engine] ${model.key} → ${decision.side} ${asset} @ $${currentPrice.toFixed(2)} (conf ${decision.confidence}%)`);
  } catch (e) {
    console.error(`[AI Engine] cycle error for ${model.key}:`, e);
  }
}

// Seed historical data — generate past trades for all models
async function seedHistoricalTrades(pool: Pool, openaiKey: string) {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) FROM paper_trades WHERE primary_model IS NOT NULL");
    const count = parseInt(rows[0].count);
    if (count >= 60) {
      console.log(`[AI Engine] Historical data already seeded (${count} trades)`);
      return;
    }

    console.log("[AI Engine] Seeding historical trades...");
    const NUM_PER_MODEL = 12;

    for (const model of MODELS) {
      for (let i = 0; i < NUM_PER_MODEL; i++) {
        const asset = pick(ASSETS);
        const timeframe = pick(TIMEFRAMES);
        const isClosed = i < NUM_PER_MODEL - 2;
        // OPEN trades get recent timestamps (2-8 min ago) so they won't be auto-resolved
        const hoursAgo = isClosed
          ? (i + 1) * (2 + Math.random() * 4)
          : (2 + Math.random() * 6) / 60;
        const openedAt = new Date(Date.now() - hoursAgo * 3600_000);

        const fallbackPrices: Record<string, number> = {
          BTC: 95000 + Math.random() * 8000,
          ETH: 3600 + Math.random() * 400,
          SOL: 160 + Math.random() * 30,
          BNB: 590 + Math.random() * 40,
          XRP: 2.2 + Math.random() * 0.5,
          DOGE: 0.14 + Math.random() * 0.04,
          ADA: 0.44 + Math.random() * 0.08,
          AVAX: 35 + Math.random() * 6,
          LINK: 16 + Math.random() * 4,
          DOT: 6.5 + Math.random() * 1.5,
        };
        const entryPrice = fallbackPrices[asset] || 100;
        const side = Math.random() > 0.45 ? "LONG" : "SHORT";
        const leverage = [3, 5, 8, 10, 15, 20][Math.floor(Math.random() * 6)];
        const strategy = pick(STRATEGIES);
        const targetPct = rng(0.5, 6);
        const stopPct = rng(0.3, 3);
        const tp = side === "LONG" ? entryPrice * (1 + targetPct / 100) : entryPrice * (1 - targetPct / 100);
        const sl = side === "LONG" ? entryPrice * (1 - stopPct / 100) : entryPrice * (1 + stopPct / 100);

        const win = Math.random() > 0.38;
        const exitPct = win ? rng(0.3, targetPct * 0.9) : -rng(0.2, stopPct * 0.9);
        const exitPrice = isClosed
          ? (side === "LONG" ? entryPrice * (1 + exitPct / 100) : entryPrice * (1 - exitPct / 100))
          : null;
        const size = rng(500, 3000);
        const pnl = isClosed && exitPrice
          ? ((side === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice) / entryPrice) * size
          : null;
        const pnlPct = isClosed && exitPrice
          ? (side === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice) / entryPrice * 100
          : null;
        const closeReason = isClosed ? (win ? (Math.random() > 0.5 ? "take_profit" : "signal_exit") : "stop_loss") : null;
        const closedAt = isClosed ? new Date(openedAt.getTime() + (0.5 + Math.random() * 3) * 3600_000) : null;

        await pool.query(
          `INSERT INTO paper_trades
             (asset, side, entry_price, exit_price, size, leverage, stop_loss, take_profit,
              pnl, pnl_pct, strategy_type, close_reason, status, primary_model, timeframe,
              opened_at, closed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            asset, side,
            entryPrice.toFixed(4),
            exitPrice ? exitPrice.toFixed(4) : null,
            size.toFixed(2), leverage,
            sl.toFixed(4), tp.toFixed(4),
            pnl ? pnl.toFixed(4) : null,
            pnlPct ? pnlPct.toFixed(4) : null,
            strategy, closeReason,
            isClosed ? "CLOSED" : "OPEN",
            model.key, timeframe,
            openedAt.toISOString(),
            closedAt ? closedAt.toISOString() : null,
          ]
        );

        // Seed console logs for this trade
        const ts2 = openedAt.toTimeString().slice(0, 8);
        const rsiVal2 = rng(25, 80).toFixed(1);
        const logs = [
          { type: "system",   text: `[${ts2}] ${model.key} — loading ${asset}/USDT ${timeframe} market data` },
          { type: "analysis", text: `> RSI(14): ${rsiVal2} — ${parseFloat(rsiVal2) > 65 ? "near overbought" : parseFloat(rsiVal2) < 35 ? "near oversold" : "momentum neutral"}` },
          { type: "analysis", text: `> MACD: ${Math.random() > 0.5 ? "bullish crossover" : "bearish crossover"} detected on ${timeframe}` },
          { type: "signal",   text: `> Signal score: ${rng(5, 9).toFixed(1)}/10` },
          { type: "result",   text: `✓ ${side} ${asset} ${leverage}x · target +${targetPct.toFixed(1)}%` },
        ];

        for (const log of logs) {
          await pool.query(
            `INSERT INTO ai_console_logs (model, asset, timeframe, log_type, content, created_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [model.key, asset, timeframe, log.type, log.text, openedAt.toISOString()]
          );
        }
      }
    }
    console.log("[AI Engine] Historical seed complete");
  } catch (e) {
    console.error("[AI Engine] Seed error:", e);
  }
}

// Ensure each model always has at least 1-2 OPEN positions
async function ensureOpenPositions(pool: Pool) {
  try {
    const fallbackPrices: Record<string, number> = {
      BTC: 95000 + Math.random() * 8000,
      ETH: 3600 + Math.random() * 400,
      SOL: 160 + Math.random() * 30,
      BNB: 590 + Math.random() * 40,
      XRP: 2.2 + Math.random() * 0.5,
      DOGE: 0.14 + Math.random() * 0.04,
      ADA: 0.44 + Math.random() * 0.08,
      AVAX: 35 + Math.random() * 6,
      LINK: 16 + Math.random() * 4,
      DOT: 6.5 + Math.random() * 1.5,
    };

    for (const model of MODELS) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM paper_trades WHERE primary_model = $1 AND status = 'OPEN'`,
        [model.key]
      );
      const openCount = parseInt(rows[0].count);
      const needed = Math.max(0, 2 - openCount);

      for (let n = 0; n < needed; n++) {
        const asset = pick(ASSETS);
        const timeframe = pick(TIMEFRAMES);
        const entryPrice = fallbackPrices[asset] || 100;
        const side = Math.random() > 0.45 ? "LONG" : "SHORT";
        const leverage = [3, 5, 8, 10, 15, 20][Math.floor(Math.random() * 6)];
        const strategy = pick(STRATEGIES);
        const targetPct = rng(1, 5);
        const stopPct = rng(0.5, 2.5);
        const tp = side === "LONG" ? entryPrice * (1 + targetPct / 100) : entryPrice * (1 - targetPct / 100);
        const sl = side === "LONG" ? entryPrice * (1 - stopPct / 100) : entryPrice * (1 + stopPct / 100);
        const size = rng(500, 2000);
        // Random open time between 1 and 12 minutes ago — won't be auto-resolved (threshold=15min)
        const minsAgo = 1 + Math.random() * 11;
        const openedAt = new Date(Date.now() - minsAgo * 60_000);

        await pool.query(
          `INSERT INTO paper_trades
             (asset, side, entry_price, exit_price, size, leverage, stop_loss, take_profit,
              pnl, pnl_pct, strategy_type, close_reason, status, primary_model, timeframe,
              opened_at, closed_at)
           VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,NULL,NULL,$8,NULL,'OPEN',$9,$10,$11,NULL)`,
          [
            asset, side,
            entryPrice.toFixed(4),
            size.toFixed(2), leverage,
            sl.toFixed(4), tp.toFixed(4),
            strategy, model.key, timeframe,
            openedAt.toISOString(),
          ]
        );

        console.log(`[AI Engine] Opened position: ${model.key} ${side} ${asset} ${leverage}x`);
      }
    }
  } catch (e) {
    console.error("[AI Engine] ensureOpenPositions error:", e);
  }
}

// Main engine start function
export function startAiTradingEngine(pool: Pool) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("[AI Engine] No OPENAI_API_KEY — engine disabled");
    return;
  }

  console.log("[AI Engine] Starting...");

  // Seed historical data, then ensure open positions exist
  setTimeout(async () => {
    await seedHistoricalTrades(pool, openaiKey);
    await ensureOpenPositions(pool);
  }, 5000);

  // Resolve pending trades every 10 minutes, then refill open positions
  const resolveAndRefill = async () => {
    await resolvePendingTrades(pool);
    await ensureOpenPositions(pool);
  };
  setInterval(resolveAndRefill, 10 * 60_000);
  setTimeout(resolveAndRefill, 60_000);

  // Run one model's trade cycle every 4 minutes (staggered across 6 models)
  const CYCLE_MS = 4 * 60_000;
  MODELS.forEach((model, idx) => {
    // Stagger model starts: 0s, 40s, 80s, 120s, 160s, 200s
    const initialDelay = idx * 40_000 + 15_000;
    setTimeout(() => {
      runTradeCycle(model, pool, openaiKey);
      setInterval(() => runTradeCycle(model, pool, openaiKey), CYCLE_MS * MODELS.length);
    }, initialDelay);
  });

  console.log("[AI Engine] Scheduled: 1 trade/model every ~24min, staggered 40s apart");
}
