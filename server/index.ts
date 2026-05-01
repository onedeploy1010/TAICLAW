import express from "express";
import { pool, supabasePool, primaryPool } from "./db.js";
import adminRoutes from "./admin-routes.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use("/api/admin", adminRoutes);

// ── CORS for dev ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj !== "object") return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = toCamel(obj[key]);
  }
  return out;
}

function handle(fn: (req: express.Request, res: express.Response) => Promise<void>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      // 42P01 = table does not exist, 42883 = function does not exist — return graceful empty
      if (err?.code === "42P01" || err?.code === "42883") {
        if (!res.headersSent) res.json(Array.isArray(err) ? [] : null);
        return;
      }
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: err.message || "Internal server error" });
    }
  };
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ ok: true }));

// ── Profiles ──────────────────────────────────────────────────────────────────
app.get("/api/profile/:wallet", handle(async (req, res) => {
  const { wallet } = req.params;
  const { rows } = await primaryPool.query(
    `SELECT p.*, r.wallet_address AS parent_wallet
     FROM profiles p
     LEFT JOIN profiles r ON r.id = p.referrer_id
     WHERE p.wallet_address = $1`,
    [wallet]
  );
  if (!rows.length) return res.json(null);
  res.json(toCamel(rows[0]));
}));

app.get("/api/profile-by-refcode/:refCode", handle(async (req, res) => {
  const { rows } = await primaryPool.query(
    "SELECT wallet_address, rank, node_type FROM profiles WHERE ref_code = $1",
    [req.params.refCode]
  );
  res.json(toCamel(rows[0] ?? null));
}));

// ── auth_wallet (plain SQL — no RPC needed) ───────────────────────────────────
app.post("/api/auth-wallet", handle(async (req, res) => {
  const { walletAddress, refCode, placementCode } = req.body;
  const addr = (walletAddress || "").toLowerCase();
  if (!addr) return res.status(400).json({ error: "walletAddress required" });

  // ── Check if user already exists ──────────────────────────────────────────
  const { rows: existing } = await primaryPool.query(
    "SELECT * FROM profiles WHERE LOWER(wallet_address) = LOWER($1)",
    [addr]
  );
  const isNewUser = existing.length === 0;

  // ── Resolve referrer & placement from code/wallet ─────────────────────────
  let referrerId: string | null = null;
  let placementId: string | null = null;

  async function resolveProfile(code: string): Promise<string | null> {
    const isWallet = String(code).startsWith("0x");
    const { rows } = await primaryPool.query(
      isWallet
        ? "SELECT id FROM profiles WHERE LOWER(wallet_address) = LOWER($1)"
        : "SELECT id FROM profiles WHERE ref_code = $1",
      [code]
    );
    return rows.length > 0 ? rows[0].id : null;
  }

  if (refCode) {
    referrerId = await resolveProfile(refCode);
    placementId = referrerId;
  }
  if (placementCode && placementCode !== refCode) {
    const pid = await resolveProfile(placementCode);
    if (pid) placementId = pid;
  }

  // ── New users MUST have a valid referrer ──────────────────────────────────
  if (isNewUser && !referrerId) {
    return res.json({ error: "REFERRAL_REQUIRED" });
  }

  // ── UPSERT profile — bind referrer/placement only once (never overwrite) ──
  const { rows } = await primaryPool.query(
    `INSERT INTO profiles (wallet_address, referrer_id, placement_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO UPDATE SET
       referrer_id  = COALESCE(profiles.referrer_id,  EXCLUDED.referrer_id),
       placement_id = COALESCE(profiles.placement_id, EXCLUDED.placement_id)
     RETURNING *`,
    [addr, referrerId, placementId]
  );
  const profile = rows[0];

  // ── Log referral binding event for new users ──────────────────────────────
  if (isNewUser && referrerId) {
    try {
      // Record on the new user's own profile
      await primaryPool.query(
        `INSERT INTO node_rewards (user_id, reward_type, amount, details, created_at)
         VALUES ($1, 'REFERRAL_BIND', 0, $2, NOW())`,
        [
          profile.id,
          JSON.stringify({
            type: "new_member_bind",
            wallet: addr,
            referrer_id: referrerId,
            placement_id: placementId,
            ref_code: refCode || null,
            placement_code: placementCode || null,
          }),
        ]
      );
      // Record on the referrer's side
      await primaryPool.query(
        `INSERT INTO node_rewards (user_id, reward_type, amount, details, created_at)
         VALUES ($1, 'NEW_REFERRAL', 0, $2, NOW())`,
        [
          referrerId,
          JSON.stringify({
            type: "new_member",
            new_member_id: profile.id,
            new_member_wallet: addr,
          }),
        ]
      );
    } catch (e) {
      console.error("Failed to log referral bind event:", e);
    }
  }

  res.json(toCamel(profile));
}));

// ── Referral Logs ─────────────────────────────────────────────────────────────
// Returns REFERRAL_BIND + NEW_REFERRAL events for a wallet (binding history)
app.get("/api/referral-logs/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query(
    "SELECT id FROM profiles WHERE LOWER(wallet_address) = LOWER($1)",
    [req.params.wallet]
  );
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    `SELECT nr.*, p.wallet_address AS member_wallet, p.ref_code AS member_ref_code
     FROM node_rewards nr
     LEFT JOIN profiles p ON p.id = (nr.details->>'new_member_id')::uuid
     WHERE nr.user_id = $1
       AND nr.reward_type IN ('REFERRAL_BIND', 'NEW_REFERRAL')
     ORDER BY nr.created_at DESC`,
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

// ── Vault ─────────────────────────────────────────────────────────────────────
app.get("/api/vault-positions/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM vault_positions WHERE user_id = $1 ORDER BY start_date DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.post("/api/vault-deposit", handle(async (req, res) => {
  const { walletAddress, planType, depositAmount, txHash } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT vault_deposit($1, $2, $3, $4) AS result",
    [walletAddress, planType, depositAmount, txHash || null]
  );
  res.json(toCamel(rows[0].result));
}));

app.post("/api/vault-withdraw", handle(async (req, res) => {
  const { walletAddress, positionId } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT vault_withdraw($1, $2) AS result",
    [walletAddress, positionId]
  );
  res.json(toCamel(rows[0].result));
}));

app.get("/api/vault-overview", handle(async (_, res) => {
  const { rows } = await primaryPool.query("SELECT get_vault_overview() AS result");
  res.json(toCamel(rows[0].result));
}));

app.get("/api/vault-rewards/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM vault_rewards WHERE user_id = $1 AND reward_type = 'DAILY_YIELD' ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

// ── Transactions ──────────────────────────────────────────────────────────────
app.get("/api/transactions/:wallet", handle(async (req, res) => {
  const { type } = req.query;
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const qText = type
    ? "SELECT * FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC"
    : "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC";
  const qArgs = type ? [p[0].id, type] : [p[0].id];
  const { rows } = await primaryPool.query(qText, qArgs);
  res.json(toCamel(rows));
}));

// ── Trade Bets ────────────────────────────────────────────────────────────────
app.post("/api/place-trade-bet", handle(async (req, res) => {
  const { walletAddress, asset, direction, amount, duration, entryPrice } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT place_trade_bet($1,$2,$3,$4,$5,$6) AS result",
    [walletAddress, asset, direction, amount, duration || "1min", entryPrice || null]
  );
  res.json(rows[0].result);
}));

app.get("/api/trade-bets/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM trade_bets WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.get("/api/trade-stats/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_trade_stats($1::text) AS result",
      [req.params.wallet]
    );
    res.json(rows[0]?.result ?? { total: 0, wins: 0, losses: 0, totalStaked: "0" });
  } catch {
    res.json({ total: 0, wins: 0, losses: 0, totalStaked: "0" });
  }
}));

// ── Strategies ────────────────────────────────────────────────────────────────
app.get("/api/strategies", handle(async (_, res) => {
  const { rows } = await primaryPool.query("SELECT * FROM strategies ORDER BY created_at");
  res.json(toCamel(rows));
}));

app.get("/api/strategy-overview", handle(async (_, res) => {
  const { rows } = await primaryPool.query("SELECT get_strategy_overview() AS result");
  res.json(toCamel(rows[0].result));
}));

app.post("/api/subscribe-strategy", handle(async (req, res) => {
  const { walletAddress, strategyId, capital } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT subscribe_strategy($1,$2,$3) AS result",
    [walletAddress, strategyId, capital]
  );
  res.json(toCamel(rows[0].result));
}));

app.get("/api/subscriptions/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM strategy_subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

// ── Nodes ─────────────────────────────────────────────────────────────────────
app.get("/api/node-membership/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json(null);
  const { rows } = await primaryPool.query(
    "SELECT * FROM node_memberships WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1",
    [p[0].id]
  );
  res.json(toCamel(rows[0] ?? null));
}));

app.get("/api/node-memberships/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM node_memberships WHERE user_id = $1 ORDER BY start_date DESC",
    [p[0].id]
  );
  const memberships = toCamel(rows);
  const { rows: txRows } = await primaryPool.query(
    "SELECT tx_hash, created_at FROM transactions WHERE user_id = $1 AND type = 'NODE_PURCHASE' ORDER BY created_at DESC",
    [p[0].id]
  );
  const txRecords = toCamel(txRows);
  res.json(memberships.map((m: any, i: number) => ({ ...m, txHash: txRecords[i]?.txHash || null })));
}));

app.get("/api/node-overview/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_node_overview($1::text) AS result",
      [req.params.wallet]
    );
    res.json(toCamel(rows[0]?.result ?? {}));
  } catch {
    res.json({ nodes: [], rewards: {}, pool: {}, rank: "--", availableBalance: "0", lockedEarnings: "0", releasedEarnings: "0", destroyedEarnings: "0" });
  }
}));

app.post("/api/purchase-node", handle(async (req, res) => {
  const { walletAddress, nodeType, txHash, paymentMode, authCode } = req.body;

  if (nodeType === "MAX" && authCode) {
    const { rows: codeRows } = await primaryPool.query(
      "SELECT id, status, node_type FROM node_auth_codes WHERE code = $1 AND status = 'ACTIVE'",
      [authCode]
    );
    if (!codeRows.length) throw new Error("Invalid or expired authorization code");
    await primaryPool.query(
      "UPDATE node_auth_codes SET status = 'USED', used_by_wallet = $1, used_at = NOW(), used_count = 1 WHERE id = $2",
      [walletAddress, codeRows[0].id]
    );
  }

  const { rows } = await primaryPool.query(
    "SELECT purchase_node($1,$2,$3,$4) AS result",
    [walletAddress, nodeType, txHash || null, paymentMode || "FULL"]
  );
  res.json(toCamel(rows[0].result));
}));

app.get("/api/validate-auth-code/:code", handle(async (req, res) => {
  const { rows } = await primaryPool.query(
    "SELECT id FROM node_auth_codes WHERE code = $1 AND status = 'ACTIVE'",
    [req.params.code]
  );
  res.json({ valid: rows.length > 0 });
}));

app.get("/api/node-milestone-requirements/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_node_milestone_requirements($1::text) AS result",
      [req.params.wallet]
    );
    res.json(toCamel(rows[0]?.result ?? { vaultDeposited: 0, directNodeReferrals: 0, directMiniReferrals: 0, activatedRank: null, earningsPaused: false }));
  } catch {
    res.json({ vaultDeposited: 0, directNodeReferrals: 0, directMiniReferrals: 0, activatedRank: null, earningsPaused: false });
  }
}));

app.post("/api/check-node-milestones", handle(async (req, res) => {
  const { walletAddress } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT check_node_milestones($1) AS result",
    [walletAddress]
  );
  res.json(toCamel(rows[0].result));
}));

app.get("/api/node-earnings/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM node_rewards WHERE user_id = $1 AND reward_type IN ('FIXED_YIELD', 'POOL_DIVIDEND') ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows).map((r: any) => ({ ...r, details: r.details || {} })));
}));

// ── 统一节点奖励端点（新体系）—— 按奖励类型分组返回 ─────────────────────────
app.get("/api/node-rewards/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json({ rewards: [], byType: {}, totals: {} });

  const { rows } = await primaryPool.query(
    "SELECT * FROM node_rewards WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  const rewards = toCamel(rows).map((r: any) => ({ ...r, details: r.details || {} }));

  // Group by reward_type and compute per-type totals
  const byType: Record<string, any[]> = {};
  const totals: Record<string, number> = {};
  for (const r of rewards) {
    const t = r.rewardType || "UNKNOWN";
    if (!byType[t]) byType[t] = [];
    byType[t].push(r);
    totals[t] = (totals[t] ?? 0) + Number(r.amount ?? 0);
  }

  res.json({ rewards, byType, totals });
}));

// ── Referral & Rank ───────────────────────────────────────────────────────────
app.get("/api/referral-tree/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_referral_tree($1::text) AS result",
      [req.params.wallet]
    );
    res.json(rows[0]?.result ?? { referrals: [], teamSize: 0, directCount: 0 });
  } catch {
    res.json({ referrals: [], teamSize: 0, directCount: 0 });
  }
}));

app.get("/api/rank-status/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_rank_status($1::text) AS result",
      [req.params.wallet]
    );
    res.json(rows[0]?.result ?? {});
  } catch {
    res.json({});
  }
}));

app.get("/api/team-stats/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_user_team_stats($1::text) AS result",
      [req.params.wallet]
    );
    res.json(rows[0]?.result ?? {});
  } catch {
    res.json({});
  }
}));

app.post("/api/check-rank-promotion", handle(async (req, res) => {
  const { walletAddress } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT check_rank_promotion($1) AS result",
    [walletAddress]
  );
  res.json(rows[0].result);
}));

// ── Commissions ───────────────────────────────────────────────────────────────
app.get("/api/commissions/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json({ totalCommission: "0", directReferralTotal: "0", differentialTotal: "0", records: [] });

  const { rows } = await primaryPool.query(
    "SELECT * FROM node_rewards WHERE user_id = $1 AND reward_type = 'TEAM_COMMISSION' ORDER BY created_at DESC",
    [p[0].id]
  );
  const records = toCamel(rows).map((r: any) => ({ ...r, details: r.details || {} }));

  let directTotal = 0, diffTotal = 0, sameRankTotal = 0, overrideTotal = 0;
  for (const r of records) {
    const amt = Number(r.amount || 0);
    if (r.details?.type === "direct_referral") directTotal += amt;
    else if (r.details?.type === "same_rank") sameRankTotal += amt;
    else if (r.details?.type === "override") overrideTotal += amt;
    else diffTotal += amt;
  }

  const sourceIds = Array.from(new Set(records.map((r: any) => r.details?.source_user || r.details?.sourceUser).filter(Boolean)));
  const sourceMap: Record<string, any> = {};
  if (sourceIds.length > 0) {
    const { rows: sources } = await primaryPool.query(
      "SELECT id, wallet_address, rank FROM profiles WHERE id = ANY($1)",
      [sourceIds]
    );
    for (const s of sources) sourceMap[s.id] = { wallet: s.wallet_address, rank: s.rank };
  }

  for (const r of records) {
    const sid = r.details?.source_user || r.details?.sourceUser;
    if (sid && sourceMap[sid]) { r.sourceWallet = sourceMap[sid].wallet; r.sourceRank = sourceMap[sid].rank; }
  }

  res.json({
    totalCommission: (directTotal + diffTotal + sameRankTotal + overrideTotal).toFixed(6),
    directReferralTotal: directTotal.toFixed(6),
    differentialTotal: diffTotal.toFixed(6),
    sameRankTotal: sameRankTotal.toFixed(6),
    overrideTotal: overrideTotal.toFixed(6),
    records,
  });
}));

// ── Prediction Bets ───────────────────────────────────────────────────────────
app.get("/api/prediction-bets/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM prediction_bets WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.post("/api/place-prediction-bet", handle(async (req, res) => {
  const { walletAddress, marketId, marketType, question, choice, odds, amount } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT place_prediction_bet($1,$2,$3,$4,$5,$6,$7) AS result",
    [walletAddress, marketId, marketType || "polymarket", question || "", choice, odds || 1, amount]
  );
  res.json(toCamel(rows[0].result));
}));

// ── AI Predictions ────────────────────────────────────────────────────────────
app.get("/api/ai-predictions", handle(async (_, res) => {
  try {
    const { rows } = await primaryPool.query(
      `SELECT id, asset, timeframe, model, prediction, confidence, target_price, current_price,
              reasoning, fear_greed_index, NULL::TEXT AS fear_greed_label, expires_at, created_at
       FROM ai_prediction_records WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

// AI prediction via OpenAI (ported from edge function)
const predictionCache = new Map<string, { data: any; expiresAt: number }>();
const PREDICTION_CACHE_TTL = 2 * 60 * 1000;
let fgiCache: { data: any; expiresAt: number } | null = null;
const FGI_CACHE_TTL = 5 * 60 * 1000;
const priceCache = new Map<string, { data: number; expiresAt: number }>();
const PRICE_CACHE_TTL = 30 * 1000;

async function fetchFearGreedIndex() {
  if (fgiCache && Date.now() < fgiCache.expiresAt) return fgiCache.data;
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    const data = await res.json();
    const result = { value: parseInt(data.data[0].value), classification: data.data[0].value_classification };
    fgiCache = { data: result, expiresAt: Date.now() + FGI_CACHE_TTL };
    return result;
  } catch { return { value: 50, classification: "Neutral" }; }
}

async function fetchCurrentPrice(asset: string): Promise<number> {
  const cached = priceCache.get(asset);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  try {
    const res = await fetch(`https://api.binance.us/api/v3/ticker/price?symbol=${asset}USDT`);
    if (res.ok) {
      const d = await res.json();
      const p = parseFloat(d.price);
      if (p > 0) { priceCache.set(asset, { data: p, expiresAt: Date.now() + PRICE_CACHE_TTL }); return p; }
    }
  } catch {}
  return 0;
}

const TIMEFRAME_LABELS: Record<string, string> = {
  "5M": "5-minute", "15M": "15-minute", "30M": "30-minute",
  "1H": "1-hour", "4H": "4-hour", "1D": "1-day", "1W": "1-week",
};

app.post("/api/ai-prediction", handle(async (req, res) => {
  const { asset, timeframe } = req.body;
  const assetUp = (asset || "BTC").toUpperCase();
  const tf = timeframe || "1H";
  const cacheKey = `${assetUp}:${tf}`;
  const cached = predictionCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return res.json({ ...cached.data, cached: true });

  const tfMaxMovePct: Record<string, number> = {
    "5M": 0.003, "15M": 0.005, "30M": 0.008, "1H": 0.012, "4H": 0.025, "1D": 0.05, "1W": 0.10,
  };
  const maxMovePct = tfMaxMovePct[tf] || 0.05;
  const [fearGreed, currentPrice] = await Promise.all([fetchFearGreedIndex(), fetchCurrentPrice(assetUp)]);
  const maxMove = currentPrice * maxMovePct;
  const priceFloor = Math.max(0, currentPrice - maxMove);
  const priceCeil = currentPrice + maxMove;
  const tfLabel = TIMEFRAME_LABELS[tf] || tf;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) { res.status(503).json({ error: "AI service not configured" }); return; }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}`, "HTTP-Referer": "https://qaprotocol.io", "X-Title": "QA Protocol" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a crypto market analyst. Analyze the market and provide a prediction in JSON format only. Response must be valid JSON with these fields: prediction (BULLISH/BEARISH/NEUTRAL), confidence (0-100), targetPrice (number very close to current price within allowed range), reasoning (1 sentence)." },
        { role: "user", content: `Analyze ${assetUp} at $${currentPrice}. Fear & Greed Index: ${fearGreed.value} (${fearGreed.classification}). Predict the ${tfLabel} price movement. IMPORTANT: targetPrice must be between $${priceFloor.toFixed(2)} and $${priceCeil.toFixed(2)} (max ${(maxMovePct * 100).toFixed(1)}% move for ${tfLabel} timeframe).` },
      ],
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  let targetPrice = Number(parsed.targetPrice) || currentPrice;
  targetPrice = Math.max(priceFloor, Math.min(priceCeil, targetPrice));

  const prediction = {
    asset: assetUp,
    prediction: parsed.prediction || "NEUTRAL",
    confidence: String(parsed.confidence || 50),
    targetPrice: String(targetPrice),
    currentPrice: String(currentPrice),
    fearGreedIndex: fearGreed.value,
    fearGreedLabel: fearGreed.classification,
    reasoning: parsed.reasoning || "",
    timeframe: tf,
  };
  predictionCache.set(cacheKey, { data: prediction, expiresAt: Date.now() + PREDICTION_CACHE_TTL });
  res.json(prediction);
}));

// ── AI Forecast (multi-model) ─────────────────────────────────────────────────
app.post("/api/ai-forecast", handle(async (req, res) => {
  const { asset, timeframe } = req.body;
  const assetUp = (asset || "BTC").toUpperCase();
  const tf = timeframe || "1H";
  const [fearGreed, currentPrice] = await Promise.all([fetchFearGreedIndex(), fetchCurrentPrice(assetUp)]);
  const tfLabel = TIMEFRAME_LABELS[tf] || tf;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) { res.status(503).json({ error: "AI service not configured" }); return; }

  const models = [
    { name: "GPT-4o", prompt: "You are GPT-4o, a sophisticated AI analyst." },
    { name: "DeepSeek", prompt: "You are DeepSeek, a deep learning market analyst." },
    { name: "Llama 3.1", prompt: "You are Llama, a reasoning-focused market analyst." },
    { name: "Gemini", prompt: "You are Gemini, Google's multi-modal AI analyst." },
    { name: "Grok", prompt: "You are Grok, xAI's market analyst." },
  ];

  const forecasts = await Promise.all(models.map(async (m) => {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}`, "HTTP-Referer": "https://qaprotocol.io", "X-Title": "QA Protocol" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: `${m.prompt} Respond with JSON only: {prediction, confidence (0-100), targetPrice, reasoning}` },
            { role: "user", content: `Analyze ${assetUp} at $${currentPrice}. FGI: ${fearGreed.value}. Predict ${tfLabel} direction.` },
          ],
          max_tokens: 150,
          response_format: { type: "json_object" },
        }),
      });
      const data = await r.json();
      const p = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      return { model: m.name, prediction: p.prediction || "NEUTRAL", confidence: p.confidence || 50, targetPrice: p.targetPrice || currentPrice, reasoning: p.reasoning || "" };
    } catch {
      return { model: m.name, prediction: "NEUTRAL", confidence: 50, targetPrice: currentPrice, reasoning: "Analysis unavailable" };
    }
  }));

  res.json({ asset: assetUp, timeframe: tf, currentPrice, forecasts });
}));

app.post("/api/ai-forecast-multi", handle(async (req, res) => {
  const { asset, timeframe } = req.body;
  const assetUp = (asset || "BTC").toUpperCase();
  const tf = timeframe || "1H";
  const [fearGreed, currentPrice] = await Promise.all([fetchFearGreedIndex(), fetchCurrentPrice(assetUp)]);
  const tfLabel = TIMEFRAME_LABELS[tf] || tf;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) { res.status(503).json({ error: "AI service not configured" }); return; }

  const models = [
    { name: "GPT-4o", prompt: "You are GPT-4o, a sophisticated AI analyst." },
    { name: "DeepSeek", prompt: "You are DeepSeek, a deep learning market analyst." },
    { name: "Llama 3.1", prompt: "You are Llama, a reasoning-focused market analyst." },
    { name: "Gemini", prompt: "You are Gemini, Google's multi-modal AI analyst." },
    { name: "Grok", prompt: "You are Grok, xAI's market analyst." },
  ];

  const forecasts = await Promise.all(models.map(async (m) => {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}`, "HTTP-Referer": "https://qaprotocol.io", "X-Title": "QA Protocol" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: `${m.prompt} Respond with JSON only: {prediction, confidence (0-100), targetPrice, reasoning}` },
            { role: "user", content: `Analyze ${assetUp} at $${currentPrice}. FGI: ${fearGreed.value}. Predict ${tfLabel} direction.` },
          ],
          max_tokens: 150,
          response_format: { type: "json_object" },
        }),
      });
      const data = await r.json();
      const p = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      return { model: m.name, prediction: p.prediction || "NEUTRAL", confidence: p.confidence || 50, targetPrice: p.targetPrice || currentPrice, reasoning: p.reasoning || "" };
    } catch {
      return { model: m.name, prediction: "NEUTRAL", confidence: 50, targetPrice: currentPrice, reasoning: "Analysis unavailable" };
    }
  }));

  res.json({ asset: assetUp, timeframe: tf, currentPrice, forecasts });
}));

// ── API Proxy (for external APIs, server-side, avoids CORS) ──────────────────
const ALLOWED_HOSTS = [
  "api.coingecko.com",
  "gamma-api.polymarket.com",
  "api.binance.com",
  "api.binance.us",
  "api.bybit.com",
  "api.alternative.me",
  "api.kraken.com",
  "api.coinbase.com",
];

app.post("/api/proxy", handle(async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) return res.status(403).json({ error: "Host not allowed" });
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "CoinMax/1.0" } });
  const data = await r.text();
  res.status(r.status).set("Content-Type", r.headers.get("Content-Type") || "application/json").send(data);
}));

// ── News Predictions ──────────────────────────────────────────────────────────
app.get("/api/news-predictions", handle(async (_, res) => {
  try {
    const { rows } = await primaryPool.query(
      `SELECT id, asset, timeframe, model, prediction, confidence, target_price, current_price,
              reasoning, fear_greed_index, expires_at, created_at
       FROM ai_prediction_records WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20`
    );
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

// ── System Config / MA Price ──────────────────────────────────────────────────
app.get("/api/system-config", handle(async (_, res) => {
  const { rows } = await primaryPool.query("SELECT key, value FROM system_config");
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(map);
}));

app.get("/api/ma-price", handle(async (_, res) => {
  const { rows } = await primaryPool.query(
    "SELECT key, value FROM system_config WHERE key IN ('MA_TOKEN_PRICE', 'MA_PRICE_SOURCE')"
  );
  const priceRow = rows.find((r: any) => r.key === "MA_TOKEN_PRICE");
  const sourceRow = rows.find((r: any) => r.key === "MA_PRICE_SOURCE");
  res.json({ price: Number(priceRow?.value) || 0.1, source: sourceRow?.value || "DEFAULT" });
}));

// ── Insurance ─────────────────────────────────────────────────────────────────
app.get("/api/hedge-positions/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM hedge_positions WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.get("/api/hedge-purchases/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM insurance_purchases WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.post("/api/purchase-hedge", handle(async (req, res) => {
  const { walletAddress, hedgeAmount } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT purchase_hedge($1,$2) AS result",
    [walletAddress, hedgeAmount]
  );
  res.json(toCamel(rows[0].result));
}));

app.get("/api/insurance-pool", handle(async (_, res) => {
  try {
    const { rows } = await primaryPool.query("SELECT get_insurance_pool() AS result");
    res.json(toCamel(rows[0]?.result ?? {}));
  } catch {
    res.json({});
  }
}));

// ── VIP ───────────────────────────────────────────────────────────────────────
app.post("/api/subscribe-vip", handle(async (req, res) => {
  const { walletAddress, txHash, planLabel } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT subscribe_vip($1,$2,$3) AS result",
    [walletAddress, txHash || null, planLabel || "monthly"]
  );
  res.json(toCamel(rows[0].result));
}));

// ── Earnings Releases ─────────────────────────────────────────────────────────
app.post("/api/request-earnings-release", handle(async (req, res) => {
  const { walletAddress, releaseDays, amount, sourceType } = req.body;
  const { rows } = await primaryPool.query(
    "SELECT request_earnings_release($1,$2,$3,$4) AS result",
    [walletAddress, releaseDays, amount, sourceType || "VAULT"]
  );
  res.json(rows[0].result);
}));

app.get("/api/earnings-releases/:wallet", handle(async (req, res) => {
  try {
    const { rows } = await primaryPool.query(
      "SELECT get_earnings_releases($1::text) AS result",
      [req.params.wallet]
    );
    res.json(rows[0]?.result ?? []);
  } catch {
    res.json([]);
  }
}));

// ── Trade Signals & Paper Trades ──────────────────────────────────────────────
app.get("/api/trade-signals", handle(async (req, res) => {
  try {
    const { limit = 20, status = "active" } = req.query;
    const { rows } = await primaryPool.query(
      "SELECT * FROM trade_signals WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
      [status, Number(limit)]
    );
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

app.get("/api/paper-trades", handle(async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    const qText = status
      ? "SELECT * FROM paper_trades WHERE status = $1 ORDER BY opened_at DESC LIMIT $2"
      : "SELECT * FROM paper_trades ORDER BY opened_at DESC LIMIT $1";
    const qArgs = status ? [status, Number(limit)] : [Number(limit)];
    const { rows } = await primaryPool.query(qText, qArgs);
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

// ── AI Model Accuracy ─────────────────────────────────────────────────────────
app.get("/api/ai-model-accuracy", handle(async (_, res) => {
  const { rows } = await primaryPool.query(
    "SELECT * FROM ai_model_accuracy ORDER BY updated_at DESC"
  );
  res.json(toCamel(rows));
}));

// ── Exchange Key Bind ─────────────────────────────────────────────────────────
app.get("/api/bind-exchange-key", handle(async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT id, exchange, label, masked_key, testnet, is_valid, last_validated, created_at FROM user_exchange_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  res.json(toCamel(rows));
}));

app.delete("/api/bind-exchange-key", handle(async (req, res) => {
  const { userId, exchange } = req.body;
  await primaryPool.query("DELETE FROM user_exchange_keys WHERE user_id = $1 AND exchange = $2", [userId, exchange]);
  res.json({ ok: true });
}));

// ── Provider API routes ───────────────────────────────────────────────────────
app.get("/api/provider/dashboard", handle(async (req, res) => {
  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) return res.status(401).json({ error: "Unauthorized" });
  const { rows } = await primaryPool.query("SELECT * FROM strategy_providers WHERE api_key = $1", [apiKey]);
  if (!rows.length) return res.status(404).json({ error: "Provider not found" });
  res.json({ provider: toCamel(rows[0]) });
}));

app.get("/api/provider/signals", handle(async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    const limit = parseInt(req.query.limit as string) || 100;
    if (!apiKey) return res.status(401).json({ error: "Unauthorized" });
    const { rows: p } = await primaryPool.query("SELECT id FROM strategy_providers WHERE api_key = $1", [apiKey]);
    if (!p.length) return res.status(404).json({ error: "Provider not found" });
    const { rows } = await primaryPool.query("SELECT * FROM trade_signals WHERE provider_id = $1 ORDER BY created_at DESC LIMIT $2", [p[0].id, limit]);
    res.json({ signals: toCamel(rows) });
  } catch {
    res.json({ signals: [] });
  }
}));

// ── Copy Trading ──────────────────────────────────────────────────────────────
app.get("/api/trade-config/:wallet", handle(async (req, res) => {
  const { rows } = await primaryPool.query(
    "SELECT * FROM user_trade_configs WHERE wallet_address = $1",
    [req.params.wallet]
  );
  res.json(toCamel(rows[0] ?? null));
}));

app.post("/api/trade-config", handle(async (req, res) => {
  const { walletAddress, ...config } = req.body;
  const { rows: existing } = await primaryPool.query(
    "SELECT id FROM user_trade_configs WHERE wallet_address = $1",
    [walletAddress]
  );
  if (existing.length) {
    const { rows } = await primaryPool.query(
      `UPDATE user_trade_configs SET
        exchange = COALESCE($2, exchange),
        is_active = COALESCE($3, is_active),
        execution_mode = COALESCE($4, execution_mode),
        position_size_usd = COALESCE($5, position_size_usd),
        max_leverage = COALESCE($6, max_leverage),
        updated_at = NOW()
       WHERE wallet_address = $1 RETURNING *`,
      [walletAddress, config.exchange, config.isActive, config.executionMode, config.positionSizeUsd, config.maxLeverage]
    );
    return res.json(toCamel(rows[0]));
  }
  const { rows } = await primaryPool.query(
    "INSERT INTO user_trade_configs (wallet_address, exchange) VALUES ($1, $2) RETURNING *",
    [walletAddress, config.exchange || "binance"]
  );
  res.json(toCamel(rows[0]));
}));

app.get("/api/copy-orders/:wallet", handle(async (req, res) => {
  const { rows } = await primaryPool.query(
    "SELECT * FROM copy_trade_orders WHERE user_wallet = $1 ORDER BY opened_at DESC LIMIT 100",
    [req.params.wallet]
  );
  res.json(toCamel(rows));
}));

// ── MA Swap Records ───────────────────────────────────────────────────────────
app.get("/api/ma-swap/:wallet", handle(async (req, res) => {
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [req.params.wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    "SELECT * FROM ma_swap_records WHERE user_id = $1 ORDER BY created_at DESC",
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

// ── Admin: Daily Settlement ───────────────────────────────────────────────────
app.post("/api/admin/daily-settlement", handle(async (_, res) => {
  const { rows } = await primaryPool.query("SELECT run_daily_settlement() AS result");
  res.json(rows[0].result);
}));

// ── Profile by wallet query param ────────────────────────────────────────────
app.get("/api/profile", handle(async (req, res) => {
  const wallet = req.query.wallet as string;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows } = await primaryPool.query(
    `SELECT p.*, r.wallet_address AS parent_wallet FROM profiles p LEFT JOIN profiles r ON r.id = p.referrer_id WHERE p.wallet_address = $1`,
    [wallet]
  );
  res.json(rows.length ? toCamel(rows[0]) : null);
}));

// ── Trade Signals ─────────────────────────────────────────────────────────────
app.get("/api/trade-signals", handle(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const asset = req.query.asset as string;
    let q = "SELECT * FROM trade_signals", args: any[] = [];
    if (asset) { q += " WHERE asset = $1"; args.push(asset); }
    q += ` ORDER BY created_at DESC LIMIT $${args.length + 1}`;
    args.push(limit);
    const { rows } = await primaryPool.query(q, args);
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

// ── Paper Trades ──────────────────────────────────────────────────────────────
app.get("/api/paper-trades", handle(async (req, res) => {
  try {
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const asset = req.query.asset as string;
    const offset = (page - 1) * pageSize;
    const args: any[] = [status || "OPEN"];
    let where = "WHERE status = $1";
    if (asset) { args.push(asset); where += ` AND asset = $${args.length}`; }
    args.push(pageSize); args.push(offset);
    const [{ rows }, { rows: cnt }] = await Promise.all([
      primaryPool.query(`SELECT * FROM paper_trades ${where} ORDER BY COALESCE(opened_at, created_at) DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args),
      primaryPool.query(`SELECT COUNT(*) FROM paper_trades ${where}`, args.slice(0, -2)),
    ]);
    if (status === "CLOSED") return res.json({ data: toCamel(rows), count: parseInt(cnt[0].count) });
    res.json(toCamel(rows));
  } catch {
    res.json([]);
  }
}));

// ── User Risk Config ──────────────────────────────────────────────────────────
app.post("/api/user-risk-config", handle(async (req, res) => {
  const { userId, killSwitch, copyEnabled } = req.body;
  await primaryPool.query(
    `INSERT INTO user_risk_config (user_id, kill_switch, copy_enabled, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET kill_switch = $2, copy_enabled = $3, updated_at = NOW()`,
    [userId, killSwitch ?? false, copyEnabled ?? false]
  );
  res.json({ ok: true });
}));

// ── Vault Yield ───────────────────────────────────────────────────────────────
app.get("/api/vault-yield", handle(async (req, res) => {
  const wallet = req.query.wallet as string;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [wallet]);
  if (!p.length) return res.json({ yieldUsd: 0, positions: [] });
  const { rows } = await primaryPool.query(
    "SELECT * FROM vault_positions WHERE user_id = $1 AND status = 'ACTIVE'",
    [p[0].id]
  );
  let total = 0;
  const now = new Date();
  for (const pos of rows) {
    if (pos.bonus_yield_locked) continue;
    const start = new Date(pos.start_date);
    const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400_000));
    total += Number(pos.principal) * Number(pos.daily_rate) * days;
  }
  res.json({ yieldUsd: total, positions: toCamel(rows) });
}));

// ── Vault Record ──────────────────────────────────────────────────────────────
app.post("/api/vault-record", handle(async (req, res) => {
  const { walletAddress, txHash, planType, principal, dailyRate, days, maPrice, maMinted } = req.body;
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [walletAddress]);
  if (!p.length) return res.status(404).json({ error: "Profile not found" });
  await primaryPool.query(
    `INSERT INTO vault_positions (user_id, plan_type, principal, daily_rate, duration_days, ma_price, ma_minted, tx_hash, status, start_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',NOW())
     ON CONFLICT (tx_hash) DO NOTHING`,
    [p[0].id, planType, principal, dailyRate, days, maPrice, maMinted, txHash]
  );
  res.json({ ok: true });
}));

// ── Claim Yield ───────────────────────────────────────────────────────────────
app.post("/api/claim-yield", handle(async (req, res) => {
  const { walletAddress, planIndex, amount } = req.body;
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [walletAddress]);
  if (!p.length) return res.status(404).json({ error: "Profile not found" });
  res.json({ ok: true, message: "Claim recorded", walletAddress, planIndex, amount });
}));

// ── RUNE Lock (veRUNE) ────────────────────────────────────────────────────────
app.get("/api/rune-lock", handle(async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    `SELECT * FROM rune_lock_positions WHERE user_id = $1 ORDER BY created_at DESC`,
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.post("/api/rune-lock", handle(async (req, res) => {
  const { walletAddress, runeAmount, lockDays, txHash, usdtAmount, runePrice } = req.body;
  if (!walletAddress || !runeAmount || !lockDays) return res.status(400).json({ error: "Missing required fields" });
  const { rows: p } = await primaryPool.query(
    "INSERT INTO profiles (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address RETURNING id",
    [walletAddress]
  );
  const veRune = Number(runeAmount) * 0.35 * (Number(lockDays) / 540);
  const endDate = new Date(Date.now() + Number(lockDays) * 86400 * 1000).toISOString();
  const { rows } = await primaryPool.query(
    `INSERT INTO rune_lock_positions (user_id, usdt_amount, rune_amount, rune_price, lock_days, ve_rune, tx_hash, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [p[0].id, usdtAmount || null, runeAmount, runePrice || null, lockDays, veRune.toFixed(6), txHash || null, endDate]
  );
  res.json(toCamel(rows[0]));
}));

app.get("/api/rune-lock/stats", handle(async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [wallet]);
  if (!p.length) return res.json({ totalRuneLocked: "0", totalVeRune: "0", positions: 0 });
  const { rows } = await primaryPool.query(
    `SELECT COALESCE(SUM(rune_amount), 0) AS total_rune, COALESCE(SUM(ve_rune), 0) AS total_ve_rune, COUNT(*) AS pos_count
     FROM rune_lock_positions WHERE user_id = $1 AND status = 'ACTIVE'`,
    [p[0].id]
  );
  res.json({ totalRuneLocked: rows[0].total_rune, totalVeRune: rows[0].total_ve_rune, positions: parseInt(rows[0].pos_count) });
}));

// ── EMBER Burn (burn RUNE → daily EMBER) ─────────────────────────────────────
app.get("/api/ember-burn", handle(async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [wallet]);
  if (!p.length) return res.json([]);
  const { rows } = await primaryPool.query(
    `SELECT * FROM ember_burn_positions WHERE user_id = $1 ORDER BY created_at DESC`,
    [p[0].id]
  );
  res.json(toCamel(rows));
}));

app.post("/api/ember-burn", handle(async (req, res) => {
  const { walletAddress, runeAmount, txHash, usdtAmount, runePrice } = req.body;
  if (!walletAddress || !runeAmount) return res.status(400).json({ error: "Missing required fields" });
  const { rows: p } = await primaryPool.query(
    "INSERT INTO profiles (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address RETURNING id",
    [walletAddress]
  );
  const amount = Number(runeAmount);
  const dailyRate = amount >= 5000 ? 0.015 : amount >= 1000 ? 0.014 : amount >= 500 ? 0.013 : amount >= 100 ? 0.012 : 0.010;
  const { rows } = await primaryPool.query(
    `INSERT INTO ember_burn_positions (user_id, usdt_amount, rune_amount, rune_price, daily_rate, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [p[0].id, usdtAmount || null, runeAmount, runePrice || null, dailyRate, txHash || null]
  );
  res.json(toCamel(rows[0]));
}));

app.post("/api/ember-burn/claim", handle(async (req, res) => {
  const { walletAddress, positionId } = req.body;
  if (!walletAddress || !positionId) return res.status(400).json({ error: "Missing required fields" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [walletAddress]);
  if (!p.length) return res.status(404).json({ error: "Profile not found" });
  const { rows } = await primaryPool.query(
    `SELECT * FROM ember_burn_positions WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [positionId, p[0].id]
  );
  if (!rows.length) return res.status(404).json({ error: "Position not found" });
  const pos = rows[0];
  const daysSinceLastClaim = Math.max(0, (Date.now() - new Date(pos.last_claim_at).getTime()) / (1000 * 60 * 60 * 24));
  const pendingEmber = Number(pos.rune_amount) * Number(pos.daily_rate) * daysSinceLastClaim;
  await primaryPool.query(
    `UPDATE ember_burn_positions
     SET pending_ember = 0, total_claimed_ember = total_claimed_ember + $1, last_claim_at = NOW()
     WHERE id = $2`,
    [pendingEmber.toFixed(6), positionId]
  );
  res.json({ ok: true, claimed: pendingEmber.toFixed(6) });
}));

app.get("/api/ember-burn/stats", handle(async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { rows: p } = await primaryPool.query("SELECT id FROM profiles WHERE wallet_address = $1", [wallet]);
  if (!p.length) return res.json({ totalRuneBurned: "0", dailyEmber: "0", totalClaimedEmber: "0" });
  const { rows } = await primaryPool.query(
    `SELECT COALESCE(SUM(rune_amount), 0) AS total_burned,
            COALESCE(SUM(rune_amount * daily_rate), 0) AS daily_ember,
            COALESCE(SUM(total_claimed_ember), 0) AS total_claimed
     FROM ember_burn_positions WHERE user_id = $1 AND status = 'ACTIVE'`,
    [p[0].id]
  );
  res.json({ totalRuneBurned: rows[0].total_burned, dailyEmber: rows[0].daily_ember, totalClaimedEmber: rows[0].total_claimed });
}));

// ── Vault LP Pool Stats (protocol-wide, pre-launch node accumulation) ─────────
app.get("/api/vault/pool-stats", handle(async (_, res) => {
  const MOTHER_POOL_RATIO  = 0.35;
  const TRADING_POOL_RATIO = 0.45;
  const RESERVE_POOL_RATIO = 0.20;
  const MONTHLY_YIELD_RATE = 0.08;

  const ZERO_LOCK = { rune_total: "0", usdt_total: "0", position_count: "0" };

  // ── Queries run in parallel, each with its own fallback ────────────────────
  const safeQuery = async (pool: typeof primaryPool, sql: string, fallback: any) => {
    try { return (await pool.query(sql)).rows[0] ?? fallback; }
    catch { return fallback; }
  };

  const [motherLock, emberBurn, revRow] = await Promise.all([
    safeQuery(primaryPool,
      `SELECT COALESCE(SUM(rune_amount),0) AS rune_total,
              COALESCE(SUM(usdt_amount),0) AS usdt_total,
              COUNT(*) AS position_count
       FROM rune_lock_positions WHERE status = 'ACTIVE'`, ZERO_LOCK),
    safeQuery(primaryPool,
      `SELECT COALESCE(SUM(rune_amount),0) AS rune_total,
              COALESCE(SUM(usdt_amount),0) AS usdt_total,
              COUNT(*) AS position_count
       FROM ember_burn_positions WHERE status = 'ACTIVE'`, ZERO_LOCK),
    safeQuery(primaryPool,
      `SELECT COALESCE(SUM(balance),0) AS total FROM revenue_pools`, { total: "0" }),
  ]);
  const revTotal = Number(revRow.total);

  // Real on-chain node deposit data (falls back to 0 when Supabase unavailable)
  let nodeDepositUsdt  = 0;
  let nodeBuyerCount   = 0;
  let purchaseCount    = 0;
  let superNodeCount   = 0;
  let stdNodeCount     = 0;
  let superNodeUsdt    = 0;
  let stdNodeUsdt      = 0;
  let memberCount      = 0;

  if (supabasePool) {
    const WEI = 1e18;
    const ZERO_SB = { total_wei: "0", buyer_count: "0", purchase_count: "0", super_node_count: "0", super_wei: "0", std_node_count: "0", std_wei: "0" };
    const [sp, mc] = await Promise.all([
      safeQuery(supabasePool,
        `SELECT COALESCE(SUM(amount),0) AS total_wei,
                COUNT(DISTINCT "user") AS buyer_count,
                COUNT(*) AS purchase_count,
                COUNT(*) FILTER (WHERE node_id = 401) AS super_node_count,
                COALESCE(SUM(amount) FILTER (WHERE node_id = 401),0) AS super_wei,
                COUNT(*) FILTER (WHERE node_id = 501) AS std_node_count,
                COALESCE(SUM(amount) FILTER (WHERE node_id = 501),0) AS std_wei
         FROM rune_purchases`, ZERO_SB),
      safeQuery(supabasePool,
        `SELECT COUNT(*) AS member_count FROM rune_members`, { member_count: "0" }),
    ]);
    nodeDepositUsdt = Number(sp.total_wei) / WEI;
    nodeBuyerCount  = Number(sp.buyer_count);
    purchaseCount   = Number(sp.purchase_count);
    superNodeCount  = Number(sp.super_node_count);
    stdNodeCount    = Number(sp.std_node_count);
    superNodeUsdt   = Number(sp.super_wei) / WEI;
    stdNodeUsdt     = Number(sp.std_wei) / WEI;
    memberCount     = Number(mc.member_count);
  }

  const lockUsdt  = Number(motherLock.usdt_total);
  const burnUsdt  = Number(emberBurn.usdt_total);
  const lockRune  = Number(motherLock.rune_total);
  const burnRune  = Number(emberBurn.rune_total);

  // All deposits = real on-chain node USDT + any app-level lock/burn deposits
  const allDepositUsdt    = nodeDepositUsdt + lockUsdt + burnUsdt;
  const motherPoolBalance = allDepositUsdt * MOTHER_POOL_RATIO;
  const tradingBalance    = allDepositUsdt * TRADING_POOL_RATIO + revTotal;
  const reserveBalance    = allDepositUsdt * RESERVE_POOL_RATIO;
  const monthlyYield      = tradingBalance * MONTHLY_YIELD_RATE;
  const annualYield       = monthlyYield * 12;

  res.json({
    mother: {
      usdtTotal:     motherPoolBalance.toFixed(2),
      runeTotal:     lockRune.toFixed(4),
      lockPositions: parseInt(motherLock.position_count),
      nodeCount:     nodeBuyerCount || memberCount,
      ratio:         (MOTHER_POOL_RATIO * 100).toFixed(0),
    },
    sub: {
      usdtTotal:     burnUsdt.toFixed(2),
      runeTotal:     burnRune.toFixed(4),
      burnPositions: parseInt(emberBurn.position_count),
    },
    reservePool: {
      balance: reserveBalance.toFixed(2),
      ratio:   (RESERVE_POOL_RATIO * 100).toFixed(0),
    },
    tradingPool: {
      balance:           tradingBalance.toFixed(2),
      contributionTotal: allDepositUsdt.toFixed(2),
      monthlyYield:      monthlyYield.toFixed(2),
      annualYield:       annualYield.toFixed(2),
      monthlyRate:       (MONTHLY_YIELD_RATE * 100).toFixed(1),
      poolRatio:         (TRADING_POOL_RATIO * 100).toFixed(0),
    },
    // Real on-chain node breakdown
    nodes: {
      totalMembers:   memberCount,
      totalBuyers:    nodeBuyerCount,
      purchaseCount,
      totalDepositUsdt: nodeDepositUsdt.toFixed(2),
      superNode: { count: superNodeCount, totalUsdt: superNodeUsdt.toFixed(2), unitPrice: 2500 },
      stdNode:   { count: stdNodeCount,   totalUsdt: stdNodeUsdt.toFixed(2),   unitPrice: 1000 },
    },
    isLive: false,
  });
}));

// ── Real on-chain node purchase list ─────────────────────────────────────────
app.get("/api/vault/node-purchases", handle(async (req, res) => {
  if (!supabasePool) return res.json({ purchases: [], members: 0 });

  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [purchasesRes, membersRes] = await Promise.all([
    supabasePool.query(
      `SELECT
         p."user"     AS wallet,
         p.node_id,
         p.amount / 1e18 AS usdt_amount,
         p.paid_at,
         p.tx_hash,
         p.chain_id,
         r.referrer
       FROM rune_purchases p
       LEFT JOIN rune_referrers r ON r."user" = p."user" AND r.chain_id = p.chain_id
       ORDER BY p.paid_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    supabasePool.query(`SELECT COUNT(*) AS total FROM rune_members`),
  ]);

  const NODE_TIER: Record<number, string> = { 401: "超级节点", 501: "标准节点" };

  res.json({
    purchases: purchasesRes.rows.map((r: any) => ({
      wallet:     r.wallet,
      nodeId:     r.node_id,
      nodeTier:   NODE_TIER[r.node_id] ?? `节点 ${r.node_id}`,
      usdtAmount: Number(r.usdt_amount).toFixed(2),
      paidAt:     r.paid_at,
      txHash:     r.tx_hash,
      chainId:    r.chain_id,
      referrer:   r.referrer,
    })),
    totalMembers: Number(membersRes.rows[0].total),
    total: purchasesRes.rowCount,
  });
}));

// ── Supabase global member stats ─────────────────────────────────────────────
app.get("/api/supabase/global-stats", handle(async (req, res) => {
  if (!supabasePool) return res.json({ totalMembers: 0, activeMembers: 0, totalNodes: 0, superNodes: 0, stdNodes: 0 });
  const [membersRes, purchasesRes, activeRes] = await Promise.all([
    supabasePool.query("SELECT COUNT(*) as total FROM rune_members"),
    supabasePool.query(`SELECT COUNT(*) as total_purchases,
       COUNT(CASE WHEN node_id=401 THEN 1 END) as super_nodes,
       COUNT(CASE WHEN node_id=501 THEN 1 END) as std_nodes
       FROM rune_purchases WHERE chain_id=56`),
    supabasePool.query(`SELECT COUNT(DISTINCT "user") as active FROM rune_purchases WHERE chain_id=56`),
  ]);
  const p = purchasesRes.rows[0];
  res.json({
    totalMembers:   Number(membersRes.rows[0].total),
    activeMembers:  Number(activeRes.rows[0].active),
    totalNodes:     Number(p.total_purchases),
    superNodes:     Number(p.super_nodes),
    stdNodes:       Number(p.std_nodes),
  });
}));

// ── Supabase referral tree for a wallet ──────────────────────────────────────
app.get("/api/supabase/team/:wallet", handle(async (req, res) => {
  if (!supabasePool) return res.json({ referrals: [], teamSize: 0, directCount: 0, ownNode: null, referrer: null });
  const wallet = req.params.wallet.toLowerCase();
  const NODE_TIER: Record<number, string> = { 401: "超级节点", 501: "标准节点" };

  // Own node info + referrer (exclude self-referral rows)
  const [ownPurchase, ownRef] = await Promise.all([
    supabasePool.query(`SELECT node_id, amount/1e18 as usdt_amount FROM rune_purchases WHERE "user"=$1 AND chain_id=56 LIMIT 1`, [wallet]),
    supabasePool.query(`SELECT referrer FROM rune_referrers WHERE "user"=$1 AND chain_id=56 AND LOWER(referrer) != $1 LIMIT 1`, [wallet]),
  ]);

  // Direct referrals (level 1)
  const { rows: directRows } = await supabasePool.query(`
    SELECT r."user" as wallet, p.node_id, p.amount/1e18 as usdt_amount,
      (SELECT COUNT(*) FROM rune_referrers r2 WHERE r2.referrer=r."user" AND r2.chain_id=56) as sub_count
    FROM rune_referrers r
    LEFT JOIN rune_purchases p ON p."user"=r."user" AND p.chain_id=56
    WHERE r.referrer=$1 AND r.chain_id=56 ORDER BY r.bound_at DESC`, [wallet]);

  // Level-2 sub-referrals for each direct ref
  const subMap: Record<string, any[]> = {};
  if (directRows.length > 0) {
    const wallets = directRows.map((r: any) => r.wallet);
    const { rows: subRows } = await supabasePool.query(`
      SELECT r."user" as wallet, r.referrer, p.node_id, p.amount/1e18 as usdt_amount,
        (SELECT COUNT(*) FROM rune_referrers r2 WHERE r2.referrer=r."user" AND r2.chain_id=56) as sub_count
      FROM rune_referrers r
      LEFT JOIN rune_purchases p ON p."user"=r."user" AND p.chain_id=56
      WHERE r.referrer=ANY($1) AND r.chain_id=56 ORDER BY r.bound_at DESC`, [wallets]);
    for (const s of subRows) {
      if (!subMap[s.referrer]) subMap[s.referrer] = [];
      subMap[s.referrer].push(s);
    }
  }

  const mapMember = (row: any, level = 1): any => ({
    id:             row.wallet,
    walletAddress:  row.wallet,
    rank:           NODE_TIER[row.node_id] || "注册会员",
    nodeType:       NODE_TIER[row.node_id] || "--",
    totalDeposited: String(Number(row.usdt_amount || 0)),
    level,
    subCount:       Number(row.sub_count || 0),
    subReferrals:   (subMap[row.wallet] || []).map((s: any) => mapMember(s, level + 1)),
  });

  const referrals = directRows.map((r: any) => mapMember(r));
  const teamSize  = referrals.reduce((s, r) => s + 1 + (r.subReferrals?.length || 0), 0);

  // Performance totals (USDT invested by direct/team members)
  const directUsdt = directRows.reduce((s: number, r: any) => s + Number(r.usdt_amount || 0), 0);
  const subUsdt = Object.values(subMap).flat().reduce((s: number, r: any) => s + Number((r as any).usdt_amount || 0), 0);
  const teamUsdt = directUsdt + subUsdt;
  const ownUsdt  = Number(ownPurchase.rows[0]?.usdt_amount || 0);

  res.json({
    referrals,
    teamSize,
    directCount: directRows.length,
    ownUsdt,
    directUsdt,
    teamUsdt,
    ownNode: ownPurchase.rows[0]
      ? { nodeId: ownPurchase.rows[0].node_id, nodeTier: NODE_TIER[ownPurchase.rows[0].node_id] || "注册会员", usdtAmount: Number(ownPurchase.rows[0].usdt_amount) }
      : null,
    referrer: ownRef.rows[0]?.referrer || null,
  });
}));

// ── Static file serving (production only) ─────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = parseInt(process.env.PORT || (process.env.NODE_ENV === "production" ? "5000" : "5001"));
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
