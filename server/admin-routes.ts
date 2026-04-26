import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

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

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query(
    "SELECT id, username, password_hash, role FROM admin_users WHERE username = $1",
    [username]
  );
  if (!rows.length) return res.json({ success: false, error: "Invalid username or password" });
  const user = rows[0];
  if (password !== user.password_hash) return res.json({ success: false, error: "Invalid username or password" });
  return res.json({ success: true, role: user.role || "support" });
});

// ── Logs ──────────────────────────────────────────────────────────────────────
router.post("/logs", async (req, res) => {
  const { adminUsername, adminRole, action, targetType, targetId, details } = req.body;
  await pool.query(
    "INSERT INTO operation_logs (admin_username, admin_role, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5,$6)",
    [adminUsername, adminRole, action, targetType, targetId || null, JSON.stringify(details || {})]
  );
  res.json({ ok: true });
});

router.get("/logs", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const action = req.query.action as string;
  const offset = (page - 1) * pageSize;
  const whereClause = action ? "WHERE action = $3" : "";
  const args = action ? [pageSize, offset, action] : [pageSize, offset];
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`SELECT * FROM operation_logs ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, args),
    pool.query(`SELECT COUNT(*) FROM operation_logs ${action ? "WHERE action = $1" : ""}`, action ? [action] : []),
  ]);
  res.json({ data: toCamel(rows), total: parseInt(countRows[0].count) });
});

// ── Contract Configs ──────────────────────────────────────────────────────────
router.get("/contract-configs", async (_, res) => {
  const { rows } = await pool.query("SELECT * FROM contract_configs ORDER BY key");
  res.json(toCamel(rows));
});

router.patch("/contract-configs/:key", async (req, res) => {
  const { value, updatedBy } = req.body;
  const { rows } = await pool.query(
    "UPDATE contract_configs SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3 RETURNING *",
    [value, updatedBy, req.params.key]
  );
  res.json(toCamel(rows[0]));
});

// ── Profiles ──────────────────────────────────────────────────────────────────
router.get("/profiles", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = req.query.search as string;
  const offset = (page - 1) * pageSize;

  const whereClause = search
    ? "WHERE wallet_address ILIKE $3 OR ref_code ILIKE $3"
    : "";
  const args = search ? [pageSize, offset, `%${search}%`] : [pageSize, offset];
  const countArgs = search ? [`%${search}%`] : [];

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`SELECT * FROM profiles ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, args),
    pool.query(`SELECT COUNT(*) FROM profiles ${search ? "WHERE wallet_address ILIKE $1 OR ref_code ILIKE $1" : ""}`, countArgs),
  ]);

  const enriched = toCamel(rows).map((p: any) => ({ ...p, teamCount: 0 }));
  res.json({ data: enriched, total: parseInt(countRows[0].count) });
});

// ── Referral Pairs ────────────────────────────────────────────────────────────
router.get("/referral-pairs", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query("SELECT * FROM profiles WHERE referrer_id IS NOT NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
    pool.query("SELECT COUNT(*) FROM profiles WHERE referrer_id IS NOT NULL"),
  ]);

  const referrerIds = Array.from(new Set(rows.map((r: any) => r.referrer_id).filter(Boolean)));
  const referrerMap: Record<string, string> = {};
  if (referrerIds.length > 0) {
    const { rows: refs } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [referrerIds]);
    for (const r of refs) referrerMap[r.id] = r.wallet_address;
  }
  const enriched = toCamel(rows).map((p: any) => ({
    ...p,
    referrerWallet: referrerMap[p.referrerId] ?? null,
    teamCount: 0,
  }));
  res.json({ data: enriched, total: parseInt(countRows[0].count) });
});

// ── Referral Tree ─────────────────────────────────────────────────────────────
router.get("/referral-tree/:wallet", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, wallet_address, rank, node_type, ref_code, created_at FROM profiles WHERE wallet_address = $1",
    [req.params.wallet]
  );
  if (!rows.length) return res.json(null);
  const root = rows[0];
  const children = await getChildrenShallow(root.id, 0, 2);
  res.json({ id: root.id, walletAddress: root.wallet_address, rank: root.rank, nodeType: root.node_type, refCode: root.ref_code, createdAt: root.created_at, childCount: children.length, children });
});

router.get("/referral-children/:parentId", async (req, res) => {
  const children = await getChildrenShallow(req.params.parentId, 0, 1);
  res.json(children);
});

async function getChildrenShallow(parentId: string, depth: number, maxDepth: number): Promise<any[]> {
  const { rows } = await pool.query(
    "SELECT id, wallet_address, rank, node_type, ref_code, created_at FROM profiles WHERE placement_id = $1 ORDER BY created_at ASC",
    [parentId]
  );
  const nodes = [];
  for (const row of rows) {
    const { rows: countRows } = await pool.query("SELECT COUNT(*) FROM profiles WHERE placement_id = $1", [row.id]);
    const childCount = parseInt(countRows[0].count);
    let children: any[] = [];
    if (depth < maxDepth && childCount > 0) {
      children = await getChildrenShallow(row.id, depth + 1, maxDepth);
    }
    nodes.push({ id: row.id, walletAddress: row.wallet_address, rank: row.rank, nodeType: row.node_type, refCode: row.ref_code, createdAt: row.created_at, childCount, children });
  }
  return nodes;
}

router.get("/user-team-stats/:userId", async (req, res) => {
  const { rows } = await pool.query("SELECT get_user_team_stats($1) AS result", [req.params.userId]);
  res.json(rows[0].result);
});

// ── Vault Positions ───────────────────────────────────────────────────────────
router.get("/vault-positions", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const offset = (page - 1) * pageSize;
  const whereClause = status ? "WHERE status = $3" : "";
  const args = status ? [pageSize, offset, status] : [pageSize, offset];
  const countArgs = status ? [status] : [];

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`SELECT * FROM vault_positions ${whereClause} ORDER BY start_date DESC LIMIT $1 OFFSET $2`, args),
    pool.query(`SELECT COUNT(*) FROM vault_positions ${status ? "WHERE status = $1" : ""}`, countArgs),
  ]);

  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
  const userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { rows: users } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
    for (const u of users) userMap[u.id] = u.wallet_address;
  }
  const enriched = toCamel(rows).map((p: any) => ({ ...p, userWallet: userMap[p.userId] ?? null }));
  res.json({ data: enriched, total: parseInt(countRows[0].count) });
});

// ── Node Memberships ──────────────────────────────────────────────────────────
router.get("/node-memberships", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query("SELECT * FROM node_memberships ORDER BY start_date DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
    pool.query("SELECT COUNT(*) FROM node_memberships"),
  ]);
  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
  const userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { rows: users } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
    for (const u of users) userMap[u.id] = u.wallet_address;
  }
  const enriched = toCamel(rows).map((m: any) => ({ ...m, userWallet: userMap[m.userId] ?? null }));
  res.json({ data: enriched, total: parseInt(countRows[0].count) });
});

// ── Performance Stats ─────────────────────────────────────────────────────────
router.get("/performance-stats", async (_, res) => {
  const [profilesRes, vaultsRes, nodesRes, commissionsRes] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM profiles"),
    pool.query("SELECT principal FROM vault_positions WHERE status = 'ACTIVE'"),
    pool.query("SELECT COUNT(*) FROM node_memberships WHERE status = 'ACTIVE'"),
    pool.query("SELECT amount FROM node_rewards WHERE reward_type = 'TEAM_COMMISSION'"),
  ]);
  const totalUsers = parseInt(profilesRes.rows[0].count);
  const totalDeposited = vaultsRes.rows.reduce((s: number, r: any) => s + Number(r.principal || 0), 0);
  const activeNodes = parseInt(nodesRes.rows[0].count);
  const totalCommissions = commissionsRes.rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  res.json({ totalUsers, totalDeposited, activeNodes, totalCommissions });
});

// ── Commissions ───────────────────────────────────────────────────────────────
router.get("/commissions", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query("SELECT * FROM node_rewards WHERE reward_type = 'TEAM_COMMISSION' ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
    pool.query("SELECT COUNT(*) FROM node_rewards WHERE reward_type = 'TEAM_COMMISSION'"),
  ]);
  res.json({ data: toCamel(rows), total: parseInt(countRows[0].count) });
});

// ── Auth Codes ────────────────────────────────────────────────────────────────
router.get("/auth-codes", async (req, res) => {
  try {
    const status = req.query.status as string;
    const all = req.query.all === "1";
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = all ? 10000 : parseInt(req.query.pageSize as string) || 20;
    let q = "SELECT code, node_type, status, created_by, used_by_wallet, used_at, created_at FROM node_auth_codes", args: any[] = [];
    if (status) { q += " WHERE status = $1"; args.push(status); }
    q += " ORDER BY created_at DESC";
    if (!all) { args.push(pageSize); args.push((page - 1) * pageSize); q += ` LIMIT $${args.length - 1} OFFSET $${args.length}`; }
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(q, args),
      pool.query(`SELECT COUNT(*) FROM node_auth_codes${status ? " WHERE status = $1" : ""}`, status ? [status] : []),
    ]);
    res.json({ data: toCamel(rows), total: parseInt(countRows[0].count) });
  } catch { res.json({ data: [], total: 0 }); }
});

router.post("/auth-codes", async (req, res) => {
  const { code, nodeType, createdBy } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO node_auth_codes (code, node_type, max_uses, used_count, status, created_by) VALUES ($1,$2,1,0,'ACTIVE',$3) RETURNING *",
    [code, nodeType, createdBy]
  );
  res.json(toCamel(rows[0]));
});

router.post("/auth-codes/batch", async (req, res) => {
  const { codes, createdBy } = req.body;
  const inserted = [];
  for (const c of codes) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { rows } = await pool.query(
      "INSERT INTO node_auth_codes (code, node_type, max_uses, used_count, status, created_by) VALUES ($1,$2,1,0,'ACTIVE',$3) ON CONFLICT (code) DO NOTHING RETURNING *",
      [code, c.nodeType, createdBy]
    );
    if (rows.length) inserted.push(rows[0]);
  }
  res.json(toCamel(inserted));
});

router.patch("/auth-codes/:id/deactivate", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE node_auth_codes SET status = 'INACTIVE' WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  res.json(toCamel(rows[0]));
});

router.get("/auth-code-stats", async (_, res) => {
  const { rows } = await pool.query("SELECT status, COUNT(*) FROM node_auth_codes GROUP BY status");
  const total = rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);
  const used = parseInt(rows.find((r: any) => r.status === "USED")?.count || "0");
  const available = parseInt(rows.find((r: any) => r.status === "ACTIVE")?.count || "0");
  res.json({ total, used, available });
});

// ── Admin Users ───────────────────────────────────────────────────────────────
router.get("/admin-users", async (_, res) => {
  const { rows } = await pool.query("SELECT id, username, role, created_at FROM admin_users ORDER BY created_at ASC");
  res.json(toCamel(rows));
});

router.post("/admin-users", async (req, res) => {
  const { username, password, role } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO admin_users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role, created_at",
    [username, password, role]
  );
  res.json(toCamel(rows[0]));
});

router.patch("/admin-users/:id", async (req, res) => {
  const { role, password } = req.body;
  if (role) await pool.query("UPDATE admin_users SET role = $1 WHERE id = $2", [role, req.params.id]);
  if (password) await pool.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [password, req.params.id]);
  const { rows } = await pool.query("SELECT id, username, role, created_at FROM admin_users WHERE id = $1", [req.params.id]);
  res.json(toCamel(rows[0]));
});

router.delete("/admin-users/:id", async (req, res) => {
  await pool.query("DELETE FROM admin_users WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// ── Node Fund Records ─────────────────────────────────────────────────────────
router.get("/node-fund-records", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query("SELECT * FROM transactions WHERE type = 'NODE_PURCHASE' ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
    pool.query("SELECT COUNT(*) FROM transactions WHERE type = 'NODE_PURCHASE'"),
  ]);
  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
  const userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { rows: users } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
    for (const u of users) userMap[u.id] = u.wallet_address;
  }
  const enriched = toCamel(rows).map((t: any) => ({ ...t, userWallet: userMap[t.userId] ?? null }));
  res.json({ data: enriched, total: parseInt(countRows[0].count) });
});

router.get("/node-fund-stats", async (_, res) => {
  const { rows } = await pool.query("SELECT amount, details FROM transactions WHERE type = 'NODE_PURCHASE'");
  const totalAmount = rows.reduce((s: number, r: any) => s + Number((r.details?.frozen) || r.amount || 0), 0);
  const totalContribution = rows.reduce((s: number, r: any) => s + Number(r.details?.contribution || 0), 0);
  res.json({ totalRecords: rows.length, totalAmount, totalContribution });
});

// ── Fund Distributions ────────────────────────────────────────────────────────
router.get("/fund-distributions", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query("SELECT * FROM fund_distributions ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
    pool.query("SELECT COUNT(*) FROM fund_distributions"),
  ]);
  res.json({ data: toCamel(rows), total: parseInt(countRows[0].count) });
});

router.get("/fund-distribution-stats", async (_, res) => {
  const { rows } = await pool.query("SELECT token, amount FROM fund_distributions");
  const totalDistributed = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const usdtTotal = rows.filter((r: any) => r.token === "USDT").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const usdcTotal = rows.filter((r: any) => r.token === "USDC").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  res.json({ totalRecords: rows.length, totalDistributed, usdtTotal, usdcTotal });
});

// ── Strategy Providers ────────────────────────────────────────────────────────
router.get("/strategy-providers", async (_, res) => {
  const { rows } = await pool.query("SELECT * FROM strategy_providers ORDER BY created_at DESC");
  res.json(toCamel(rows));
});

router.patch("/strategy-providers/:id", async (req, res) => {
  const updates = req.body;
  const fields = Object.entries(updates)
    .map(([k, _], i) => `${k} = $${i + 2}`)
    .join(", ");
  const { rows } = await pool.query(
    `UPDATE strategy_providers SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [req.params.id, ...Object.values(updates)]
  );
  res.json(toCamel(rows[0]));
});



router.patch("/simulation-config", async (req, res) => {
  const { positionSizeUsd, maxPositions, maxLeverage, maxDrawdownPct, cooldownMin } = req.body;
  const { rows } = await pool.query(
    `UPDATE simulation_config SET
      position_size_usd = COALESCE($1, position_size_usd),
      max_positions = COALESCE($2, max_positions),
      max_leverage = COALESCE($3, max_leverage),
      max_drawdown_pct = COALESCE($4, max_drawdown_pct),
      cooldown_min = COALESCE($5, cooldown_min),
      updated_at = NOW()
     WHERE id = 1 RETURNING *`,
    [positionSizeUsd, maxPositions, maxLeverage, maxDrawdownPct, cooldownMin]
  );
  res.json(toCamel(rows[0]));
});

// ── Copy Trading ──────────────────────────────────────────────────────────────
router.get("/user-risk-configs", async (_, res) => {
  const { rows } = await pool.query("SELECT * FROM user_risk_config ORDER BY updated_at DESC");
  const userIds = rows.map((r: any) => r.user_id);
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { rows: profiles } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
    for (const p of profiles) profileMap[p.id] = p.wallet_address;
  }
  res.json(toCamel(rows).map((r: any) => ({ ...r, walletAddress: profileMap[r.userId] })));
});

router.get("/exchange-keys", async (_, res) => {
  const { rows } = await pool.query("SELECT id, user_id, exchange, masked_key, label, testnet, is_valid, created_at FROM user_exchange_keys ORDER BY created_at DESC");
  const userIds = rows.map((r: any) => r.user_id);
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { rows: profiles } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
    for (const p of profiles) profileMap[p.id] = p.wallet_address;
  }
  res.json(toCamel(rows).map((r: any) => ({ ...r, walletAddress: profileMap[r.userId] })));
});

// ── Treasury Config ───────────────────────────────────────────────────────────
router.get("/treasury-config", async (_, res) => {
  const { rows } = await pool.query("SELECT key, value FROM system_config WHERE key ILIKE '%TREASURY%' OR key ILIKE '%BRIDGE%'");
  res.json(toCamel(rows));
});

router.patch("/treasury-config/:key", async (req, res) => {
  const { value } = req.body;
  await pool.query("UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = $2", [value, req.params.key]);
  res.json({ ok: true });
});

router.get("/bridge-cycles", async (_, res) => {
  res.json([]);
});

router.post("/bridge-cycles", async (req, res) => {
  res.json({ ok: true, message: "Bridge cycles not yet implemented in Replit environment" });
});

// ── Admin: AI Stats (model accuracy + predictions) ────────────────────────────
router.get("/ai-stats", async (req, res) => {
  try {
    const asset = req.query.asset as string | undefined;
    const period = (req.query.period as string) || "7d";
    const predArgs: any[] = [];
    const predConds: string[] = [];
    if (asset && asset !== "ALL") { predArgs.push(asset); predConds.push(`asset = $${predArgs.length}`); }
    const predWhere = predConds.length ? "WHERE " + predConds.join(" AND ") : "";
    const modelArgs: any[] = [period];
    let modelWhere = "WHERE period = $1";
    if (asset && asset !== "ALL") { modelArgs.push(asset); modelWhere += ` AND asset = $${modelArgs.length}`; }
    const [totalRes, resolvedRes, correctRes, modelRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ai_prediction_records ${predWhere}`, predArgs),
      pool.query(`SELECT COUNT(*) FROM ai_prediction_records ${predWhere ? predWhere + " AND status = 'resolved'" : "WHERE status = 'resolved'"}`, predArgs),
      pool.query(`SELECT COUNT(*) FROM ai_prediction_records ${predWhere ? predWhere + " AND direction_correct = true" : "WHERE direction_correct = true"}`, predArgs),
      pool.query(`SELECT model, accuracy_pct, total_predictions, correct_predictions, computed_weight, avg_confidence, period, timeframe FROM ai_model_accuracy ${modelWhere}`, modelArgs).catch(() => ({ rows: [] })),
    ]);
    res.json({ total: parseInt(totalRes.rows[0].count), resolved: parseInt(resolvedRes.rows[0].count), correct: parseInt(correctRes.rows[0].count), modelAccuracy: toCamel(modelRes.rows) });
  } catch (e: any) { res.json({ total: 0, resolved: 0, correct: 0, modelAccuracy: [] }); }
});

// ── Admin: Accuracy Snapshots ──────────────────────────────────────────────────
router.get("/accuracy-snapshots", async (req, res) => {
  try {
    const { asset, from, to } = req.query;
    let q = "SELECT * FROM accuracy_daily_snapshots", args: any[] = [];
    const conds: string[] = [];
    if (asset) { args.push(asset); conds.push(`asset = $${args.length}`); }
    if (from) { args.push(from); conds.push(`snapshot_date >= $${args.length}`); }
    if (to) { args.push(to); conds.push(`snapshot_date <= $${args.length}`); }
    if (conds.length) q += " WHERE " + conds.join(" AND ");
    q += " ORDER BY snapshot_date ASC";
    const { rows } = await pool.query(q, args);
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: Training Report ─────────────────────────────────────────────────────
router.get("/training-report", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM ai_training_reports ORDER BY created_at DESC LIMIT 1");
    res.json(rows.length ? toCamel(rows[0]) : null);
  } catch { res.json(null); }
});

// ── Admin: Weight Adjustment Log ───────────────────────────────────────────────
router.get("/weight-adjustment-log", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM weight_adjustment_log ORDER BY timestamp ASC");
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: Paper Trade Stats ───────────────────────────────────────────────────
router.get("/paper-trade-stats", async (_, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [totalRes, winsRes, pnlRes, todayRes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM paper_trades WHERE status = 'CLOSED'"),
      pool.query("SELECT COUNT(*) FROM paper_trades WHERE status = 'CLOSED' AND pnl > 0"),
      pool.query("SELECT SUM(pnl) FROM paper_trades WHERE status = 'CLOSED'"),
      pool.query("SELECT SUM(pnl) FROM paper_trades WHERE status = 'CLOSED' AND closed_at::date = $1", [today]),
    ]);
    res.json({ totalClosed: parseInt(totalRes.rows[0].count), totalWins: parseInt(winsRes.rows[0].count), totalPnl: parseFloat(pnlRes.rows[0].sum || "0"), todayPnl: parseFloat(todayRes.rows[0].sum || "0") });
  } catch { res.json({ totalClosed: 0, totalWins: 0, totalPnl: 0, todayPnl: 0 }); }
});

// ── Admin: Simulation Config (GET) ──────────────────────────────────────────────
router.get("/simulation-config", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM simulation_config WHERE id = 1");
    res.json(rows.length ? toCamel(rows[0]) : {});
  } catch { res.json({}); }
});

// ── Admin: Run Simulation ──────────────────────────────────────────────────────
router.post("/run-simulation", async (_, res) => {
  res.json({ signals_generated: 0, paper_trades_opened: 0, paper_trades_closed: 0, message: "Simulation not yet implemented server-side" });
});

// ── Admin: AI Market Analysis ──────────────────────────────────────────────────
router.get("/ai-market-analysis", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT asset, model, direction, confidence, reasoning, market_sentiment, created_at FROM ai_market_analysis ORDER BY created_at DESC LIMIT 30");
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: AI Memory Stats ─────────────────────────────────────────────────────
router.get("/ai-memory-stats", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT outcome, learning_score, asset FROM ai_memory WHERE outcome != 'pending'");
    const total = rows.length, correct = rows.filter((r: any) => r.outcome === "correct").length;
    const avgScore = total > 0 ? rows.reduce((s: number, d: any) => s + (Number(d.learning_score) || 0), 0) / total : 0;
    res.json({ total, correct, accuracy: total > 0 ? (correct / total * 100) : 0, avgScore });
  } catch { res.json(null); }
});

// ── Admin: AI Predictions ──────────────────────────────────────────────────────
router.get("/ai-predictions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const { rows } = await pool.query("SELECT * FROM ai_prediction_records ORDER BY created_at DESC LIMIT $1", [limit]);
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: Cron Jobs (stub) ────────────────────────────────────────────────────
router.get("/cron-jobs", async (_, res) => {
  res.json([]);
});
router.patch("/cron-jobs/:name/schedule", async (req, res) => {
  res.json({ ok: true, message: "Cron schedule updates not supported in this environment" });
});

// ── Admin: Providers ──────────────────────────────────────────────────────────
router.get("/providers", async (req, res) => {
  try {
    const status = req.query.status as string;
    let q = "SELECT * FROM strategy_providers", args: any[] = [];
    if (status) { q += " WHERE status = $1"; args.push(status); }
    q += " ORDER BY created_at DESC";
    const { rows } = await pool.query(q, args);
    res.json({ data: toCamel(rows) });
  } catch { res.json({ data: [] }); }
});

router.patch("/providers/:id/status", async (req, res) => {
  try {
    const { status, approvedBy } = req.body;
    const updates: string[] = ["status = $1", "updated_at = NOW()"];
    const args: any[] = [status, req.params.id];
    if (status === "approved") { updates.push(`approved_by = $${args.length + 1}`, `approved_at = NOW()`); args.splice(1, 0, approvedBy); }
    await pool.query(`UPDATE strategy_providers SET ${updates.join(", ")} WHERE id = $2`, args);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: User Exchange Keys ──────────────────────────────────────────────────
router.get("/user-exchange-keys", async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT id, user_id, exchange, masked_key, label, testnet, is_valid, created_at FROM user_exchange_keys ORDER BY created_at DESC");
    const userIds = rows.map((r: any) => r.user_id);
    const profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { rows: profiles } = await pool.query("SELECT id, wallet_address FROM profiles WHERE id = ANY($1)", [userIds]);
      for (const p of profiles) profileMap[p.id] = p.wallet_address;
    }
    res.json(toCamel(rows).map((r: any) => ({ ...r, walletAddress: profileMap[r.userId] || "unknown" })));
  } catch { res.json([]); }
});

// ── Admin: Vault Deposits ──────────────────────────────────────────────────────
router.get("/vault-deposits", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const { rows } = await pool.query(
      `SELECT vp.*, p.wallet_address FROM vault_positions vp JOIN profiles p ON p.id = vp.user_id ORDER BY vp.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: MA Swaps ────────────────────────────────────────────────────────────
router.get("/ma-swaps", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const { rows } = await pool.query(
      `SELECT ms.*, p.wallet_address FROM ma_swap_records ms JOIN profiles p ON p.id = ms.user_id ORDER BY ms.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(toCamel(rows));
  } catch { res.json([]); }
});

// ── Admin: Transactions ────────────────────────────────────────────────────────
router.get("/transactions", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const types = req.query.types as string;
    const search = req.query.search as string;
    const offset = (page - 1) * pageSize;
    const args: any[] = [];
    const conds: string[] = [];
    if (types) { const list = types.split(","); args.push(list); conds.push(`t.type = ANY($${args.length})`); }
    if (search) { args.push(`%${search}%`); conds.push(`(t.tx_hash ILIKE $${args.length} OR p.wallet_address ILIKE $${args.length})`); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    args.push(pageSize); args.push(offset);
    const [{ rows }, { rows: cnt }] = await Promise.all([
      pool.query(`SELECT t.*, p.wallet_address FROM transactions t LEFT JOIN profiles p ON p.id = t.user_id ${where} ORDER BY t.created_at DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args),
      pool.query(`SELECT COUNT(*) FROM transactions t LEFT JOIN profiles p ON p.id = t.user_id ${where}`, args.slice(0, -2)),
    ]);
    res.json({ txs: toCamel(rows), total: parseInt(cnt[0].count) });
  } catch { res.json({ txs: [], total: 0 }); }
});


// ── Admin: Edge Function Proxy (stub) ─────────────────────────────────────────
router.post("/edge/:name", async (req, res) => {
  res.json({ status: "not_implemented", message: `Edge function ${req.params.name} not available in this environment` });
});

// ── Admin: Health Checks ───────────────────────────────────────────────────────
router.get("/health/models", async (_, res) => {
  try {
    const { rows: models } = await pool.query("SELECT DISTINCT model FROM ai_market_analysis");
    const checks = await Promise.all(models.map(async (m: any) => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
      const [latestRes, countRes] = await Promise.all([
        pool.query("SELECT created_at, asset FROM ai_market_analysis WHERE model = $1 ORDER BY created_at DESC LIMIT 1", [m.model]),
        pool.query("SELECT COUNT(*) FROM ai_market_analysis WHERE model = $1 AND created_at > $2", [m.model, twoHoursAgo]),
      ]);
      const lastTime = latestRes.rows[0]?.created_at || null;
      const msSince = lastTime ? Date.now() - new Date(lastTime).getTime() : Infinity;
      const count2h = parseInt(countRes.rows[0].count);
      let status = msSince > 3600_000 ? "critical" : msSince > 1800_000 ? "warning" : "healthy";
      return { name: m.model, status, latencyMs: null, lastSuccess: lastTime, message: `最近2h: ${count2h}条分析`, details: { count2h } };
    }));
    res.json(checks);
  } catch { res.json([]); }
});

router.get("/health/macmini", async (_, res) => {
  try {
    const [latestRes, countRes] = await Promise.all([
      pool.query("SELECT created_at, asset, reasoning FROM ai_market_analysis WHERE model = 'agent' ORDER BY created_at DESC LIMIT 1"),
      pool.query("SELECT COUNT(*) FROM ai_market_analysis WHERE model = 'agent' AND created_at > $1", [new Date(Date.now() - 2 * 3600_000).toISOString()]),
    ]);
    const lastTime = latestRes.rows[0]?.created_at || null;
    const msSince = lastTime ? Date.now() - new Date(lastTime).getTime() : Infinity;
    const count2h = parseInt(countRes.rows[0]?.count || "0");
    const status = msSince > 1800_000 ? "critical" : msSince > 900_000 ? "warning" : "healthy";
    res.json({ name: "🖥 Mac Mini OpenClaw", status, latencyMs: null, lastSuccess: lastTime, message: `最近2h: ${count2h}条分析推送`, details: { count2h } });
  } catch { res.json({ name: "🖥 Mac Mini OpenClaw", status: "unknown", latencyMs: null, lastSuccess: null, message: "无数据", details: {} }); }
});

router.get("/health/crons", async (_, res) => {
  try {
    const [tradeRes, analysisRes, resolvedRes, weightRes] = await Promise.all([
      pool.query("SELECT opened_at FROM paper_trades ORDER BY opened_at DESC LIMIT 1"),
      pool.query("SELECT created_at FROM ai_market_analysis ORDER BY created_at DESC LIMIT 1"),
      pool.query("SELECT resolved_at FROM ai_prediction_records WHERE resolved_at IS NOT NULL ORDER BY resolved_at DESC LIMIT 1"),
      pool.query("SELECT updated_at FROM ai_model_accuracy ORDER BY updated_at DESC LIMIT 1"),
    ]);
    const tradeTime = tradeRes.rows[0]?.opened_at || null;
    const analysisTime = analysisRes.rows[0]?.created_at || null;
    const resolvedTime = resolvedRes.rows[0]?.resolved_at || null;
    const weightTime = weightRes.rows[0]?.updated_at || null;
    const ms = (t: string | null) => t ? Date.now() - new Date(t).getTime() : Infinity;
    res.json([
      { name: "simulate-trading", schedule: "*/5 * * * *", lastRun: tradeTime, expectedInterval: 5, status: ms(tradeTime) > 15*60000 ? "critical" : ms(tradeTime) > 10*60000 ? "warning" : "healthy", message: tradeTime ? `最近开单` : "无交易记录" },
      { name: "ai-market-analysis", schedule: "*/30 * * * *", lastRun: analysisTime, expectedInterval: 30, status: ms(analysisTime) > 60*60000 ? "critical" : ms(analysisTime) > 40*60000 ? "warning" : "healthy", message: analysisTime ? "最近分析" : "无分析记录" },
      { name: "resolve-predictions", schedule: "*/5 * * * *", lastRun: resolvedTime, expectedInterval: 5, status: ms(resolvedTime) > 30*60000 ? "critical" : ms(resolvedTime) > 15*60000 ? "warning" : "healthy", message: resolvedTime ? "最近结算" : "无结算记录" },
      { name: "adjust-weights", schedule: "0 * * * *", lastRun: weightTime, expectedInterval: 60, status: ms(weightTime) > 120*60000 ? "critical" : ms(weightTime) > 90*60000 ? "warning" : "healthy", message: weightTime ? "最近调权" : "无调权记录" },
    ]);
  } catch { res.json([]); }
});

router.get("/health/data-freshness", async (_, res) => {
  try {
    const h24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const tables = [
      { table: "ai_market_analysis", label: "AI 分析数据", dateCol: "created_at", minPerHour: 5, critThreshold: 24, warnThreshold: 60 },
      { table: "paper_trades", label: "模拟交易", dateCol: "opened_at", minPerHour: 2, critThreshold: 12, warnThreshold: 24 },
      { table: "trade_signals", label: "交易信号", dateCol: "created_at", minPerHour: 2, critThreshold: 12, warnThreshold: 24 },
      { table: "ai_prediction_records", label: "AI 预测记录", dateCol: "created_at", minPerHour: 1, critThreshold: 6, warnThreshold: 12 },
    ];
    const checks = await Promise.all(tables.map(async (t) => {
      const [latestRes, countRes] = await Promise.all([
        pool.query(`SELECT ${t.dateCol} FROM ${t.table} ORDER BY ${t.dateCol} DESC LIMIT 1`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM ${t.table} WHERE ${t.dateCol} > $1`, [h24]).catch(() => ({ rows: [{ count: "0" }] })),
      ]);
      const latestRecord = latestRes.rows[0]?.[t.dateCol] || null;
      const count = parseInt(countRes.rows[0].count);
      const status = count < t.critThreshold ? "critical" : count < t.warnThreshold ? "warning" : "healthy";
      return { table: t.table, label: t.label, latestRecord, recordCount24h: count, expectedMinPerHour: t.minPerHour, status, message: `24h: ${count}条` };
    }));
    res.json(checks);
  } catch { res.json([]); }
});

router.get("/health/api-usage", async (_, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const { rows } = await pool.query(
      `SELECT model, COUNT(*) FILTER (WHERE created_at >= $1) as today_count, COUNT(*) FILTER (WHERE created_at >= $2) as month_count FROM ai_market_analysis GROUP BY model`,
      [startOfDay.toISOString(), startOfMonth.toISOString()]
    );
    res.json(rows.map((r: any) => ({ model: r.model, icon: "🤖", today: parseInt(r.today_count), month: parseInt(r.month_count), estimateMonthly: parseInt(r.month_count), tier: "按量付费" })));
  } catch { res.json([]); }
});

export default router;
