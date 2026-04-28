import {
  pgTable,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  uuid,
  jsonb,
  bigserial,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Profiles ──────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").unique().notNull(),
  refCode: text("ref_code").unique().default(sql`substr(md5(random()::text), 1, 8)`),
  referrerId: uuid("referrer_id").references((): any => profiles.id),
  placementId: uuid("placement_id").references((): any => profiles.id),
  rank: text("rank"),
  nodeType: text("node_type").default("NONE"),
  isVip: boolean("is_vip").default(false),
  vipExpiresAt: timestamp("vip_expires_at", { withTimezone: true }),
  vipTrialUsed: boolean("vip_trial_used").default(false),
  totalDeposited: numeric("total_deposited").default("0"),
  totalWithdrawn: numeric("total_withdrawn").default("0"),
  referralEarnings: numeric("referral_earnings").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Vault Positions ───────────────────────────────────────
export const vaultPositions = pgTable("vault_positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  planType: text("plan_type").notNull(),
  principal: numeric("principal").notNull(),
  dailyRate: numeric("daily_rate").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).default(sql`NOW()`),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: text("status").default("ACTIVE"),
  isBonus: boolean("is_bonus").default(false),
  bonusYieldLocked: boolean("bonus_yield_locked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Transactions ──────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  type: text("type").notNull(),
  token: text("token").notNull(),
  amount: numeric("amount").notNull(),
  txHash: text("tx_hash"),
  status: text("status").default("PENDING"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Trade Bets ────────────────────────────────────────────
export const tradeBets = pgTable("trade_bets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  asset: text("asset").notNull(),
  direction: text("direction").notNull(),
  amount: numeric("amount").notNull(),
  duration: text("duration").default("1min"),
  entryPrice: numeric("entry_price"),
  exitPrice: numeric("exit_price"),
  result: text("result"),
  pnl: numeric("pnl"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Strategies ────────────────────────────────────────────
export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").default(""),
  status: text("status").default("ACTIVE"),
  totalAum: numeric("total_aum").default("0"),
  winRate: numeric("win_rate").default("0"),
  monthlyReturn: numeric("monthly_return").default("0"),
  leverage: text("leverage").default("1x"),
  isVipOnly: boolean("is_vip_only").default(false),
  isHot: boolean("is_hot").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Strategy Subscriptions ────────────────────────────────
export const strategySubscriptions = pgTable("strategy_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  strategyId: uuid("strategy_id").notNull().references(() => strategies.id),
  allocatedCapital: numeric("allocated_capital").default("0"),
  executionMode: text("execution_mode").default("PAPER"),
  maxDrawdown: numeric("max_drawdown"),
  currentPnl: numeric("current_pnl"),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Hedge Positions ───────────────────────────────────────
export const hedgePositions = pgTable("hedge_positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  amount: numeric("amount").notNull(),
  purchaseAmount: numeric("purchase_amount").default("0"),
  currentPnl: numeric("current_pnl").default("0"),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Insurance Purchases ───────────────────────────────────
export const insurancePurchases = pgTable("insurance_purchases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  amount: numeric("amount").notNull(),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Prediction Bets ───────────────────────────────────────
export const predictionBets = pgTable("prediction_bets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  marketId: text("market_id").notNull(),
  marketType: text("market_type").notNull(),
  question: text("question"),
  choice: text("choice"),
  odds: numeric("odds"),
  amount: numeric("amount").notNull(),
  potentialPayout: numeric("potential_payout"),
  status: text("status").default("ACTIVE"),
  result: text("result"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── RUNE Lock Positions (veRUNE) ─────────────────────────
export const runeLockPositions = pgTable("rune_lock_positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  runeAmount: numeric("rune_amount").notNull(),
  lockDays: integer("lock_days").notNull(),
  veRune: numeric("ve_rune").notNull(),
  txHash: text("tx_hash"),
  startDate: timestamp("start_date", { withTimezone: true }).default(sql`NOW()`),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── EMBER Burn Positions ──────────────────────────────────
export const emberBurnPositions = pgTable("ember_burn_positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  runeAmount: numeric("rune_amount").notNull(),
  dailyRate: numeric("daily_rate").notNull(),
  pendingEmber: numeric("pending_ember").default("0"),
  totalClaimedEmber: numeric("total_claimed_ember").default("0"),
  txHash: text("tx_hash"),
  lastClaimAt: timestamp("last_claim_at", { withTimezone: true }).default(sql`NOW()`),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Admin Users ───────────────────────────────────────────
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("support"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Node Memberships ──────────────────────────────────────
export const nodeMemberships = pgTable("node_memberships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  nodeType: text("node_type").notNull(),
  price: numeric("price").notNull(),
  status: text("status").default("PENDING_MILESTONES"),
  startDate: timestamp("start_date", { withTimezone: true }).default(sql`NOW()`),
  endDate: timestamp("end_date", { withTimezone: true }),
  paymentMode: text("payment_mode").default("FULL"),
  depositAmount: numeric("deposit_amount").default("0"),
  milestoneStage: integer("milestone_stage").default(0),
  totalMilestones: integer("total_milestones").default(0),
  earningsCapacity: numeric("earnings_capacity").default("0"),
  contributionAmount: numeric("contribution_amount").default("0"),
  frozenAmount: numeric("frozen_amount").default("0"),
  dailyRate: numeric("daily_rate").default("0"),
  lockedEarnings: numeric("locked_earnings").default("0"),
  releasedEarnings: numeric("released_earnings").default("0"),
  availableBalance: numeric("available_balance").default("0"),
  durationDays: integer("duration_days"),
  txHash: text("tx_hash"),
  activatedRank: text("activated_rank"),
  earningsPaused: boolean("earnings_paused").default(false),
  destroyedEarnings: numeric("destroyed_earnings").default("0"),
  frozenUnlocked: boolean("frozen_unlocked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Node Milestones ───────────────────────────────────────
export const nodeMilestones = pgTable("node_milestones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  membershipId: uuid("membership_id").references(() => nodeMemberships.id, { onDelete: "cascade" }),
  milestoneIndex: integer("milestone_index").notNull(),
  requiredRank: text("required_rank").notNull(),
  deadlineDays: integer("deadline_days").notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  status: text("status").default("PENDING"),
  passAction: text("pass_action").default("CONTINUE"),
  failAction: text("fail_action").default("PAUSE"),
  earningRange: text("earning_range"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Node Rewards ──────────────────────────────────────────
export const nodeRewards = pgTable("node_rewards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  rewardType: text("reward_type").notNull(),
  amount: numeric("amount").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Node Auth Codes ───────────────────────────────────────
export const nodeAuthCodes = pgTable("node_auth_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").unique().notNull(),
  nodeType: text("node_type").notNull().default("MAX"),
  status: text("status").notNull().default("ACTIVE"),
  maxUses: integer("max_uses").default(1),
  usedCount: integer("used_count").default(0),
  usedBy: text("used_by"),
  usedByWallet: text("used_by_wallet"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── System Config ─────────────────────────────────────────
export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Revenue Events ────────────────────────────────────────
export const revenueEvents = pgTable("revenue_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Revenue Pools ─────────────────────────────────────────
export const revenuePools = pgTable("revenue_pools", {
  poolName: text("pool_name").primaryKey(),
  balance: numeric("balance").default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Vault Rewards ─────────────────────────────────────────
export const vaultRewards = pgTable("vault_rewards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  positionId: uuid("position_id").notNull().references(() => vaultPositions.id),
  rewardType: text("reward_type").notNull(),
  amount: numeric("amount").notNull(),
  arPrice: numeric("ar_price"),
  arAmount: numeric("ar_amount"),
  maPrice: numeric("ma_price"),
  maAmount: numeric("ma_amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Earnings Releases ─────────────────────────────────────
export const earningsReleases = pgTable("earnings_releases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  sourceType: text("source_type").notNull(),
  grossAmount: numeric("gross_amount").notNull().default("0"),
  burnRate: numeric("burn_rate").notNull().default("0"),
  burnAmount: numeric("burn_amount").notNull().default("0"),
  netAmount: numeric("net_amount").notNull().default("0"),
  releaseDays: integer("release_days").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  releaseStart: timestamp("release_start").notNull().default(sql`NOW()`),
  releaseEnd: timestamp("release_end").notNull().default(sql`NOW()`),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

// ── AI Prediction Records ─────────────────────────────────
export const aiPredictionRecords = pgTable("ai_prediction_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull(),
  model: text("model").notNull(),
  prediction: text("prediction").notNull(),
  confidence: integer("confidence").notNull(),
  targetPrice: numeric("target_price").notNull(),
  currentPrice: numeric("current_price").notNull(),
  reasoning: text("reasoning"),
  fearGreedIndex: integer("fear_greed_index"),
  rsi14: numeric("rsi_14"),
  macdSignal: text("macd_signal"),
  bbPosition: numeric("bb_position"),
  fundingRate: numeric("funding_rate"),
  longShortRatio: numeric("long_short_ratio"),
  candlePatterns: text("candle_patterns"),
  actualPrice: numeric("actual_price"),
  actualDirection: text("actual_direction"),
  actualChangePct: numeric("actual_change_pct"),
  directionCorrect: boolean("direction_correct"),
  priceErrorPct: numeric("price_error_pct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
});

// ── AI Model Accuracy ─────────────────────────────────────
export const aiModelAccuracy = pgTable("ai_model_accuracy", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  model: text("model").notNull(),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull(),
  period: text("period").notNull().default("30d"),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  accuracyPct: numeric("accuracy_pct").notNull().default("0"),
  avgConfidence: numeric("avg_confidence").notNull().default("0"),
  avgPriceErrorPct: numeric("avg_price_error_pct").notNull().default("0"),
  computedWeight: numeric("computed_weight").default("1.0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Trade Signals ─────────────────────────────────────────
export const tradeSignals = pgTable("trade_signals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  asset: text("asset").notNull(),
  action: text("action").notNull(),
  direction: text("direction"),
  probabilities: jsonb("probabilities"),
  targetPct: numeric("target_pct"),
  confidence: integer("confidence").notNull(),
  stopLossPct: numeric("stop_loss_pct"),
  takeProfitPct: numeric("take_profit_pct"),
  leverage: integer("leverage").default(1),
  positionSizePct: numeric("position_size_pct"),
  strategyType: text("strategy_type"),
  strength: text("strength"),
  sourceModels: text("source_models").array(),
  ragContext: text("rag_context"),
  providerId: uuid("provider_id"),
  status: text("status").notNull().default("active"),
  resultPnl: numeric("result_pnl"),
  closeReason: text("close_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ── Paper Trades ──────────────────────────────────────────
export const paperTrades = pgTable("paper_trades", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: uuid("signal_id").references(() => tradeSignals.id),
  userId: uuid("user_id"),
  asset: text("asset").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  exitPrice: numeric("exit_price"),
  size: numeric("size").notNull(),
  leverage: integer("leverage").default(1),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  pnl: numeric("pnl"),
  pnlPct: numeric("pnl_pct"),
  strategyType: text("strategy_type"),
  closeReason: text("close_reason"),
  status: text("status").notNull().default("OPEN"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// ── User Exchange Keys ────────────────────────────────────
export const userExchangeKeys = pgTable("user_exchange_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  exchange: text("exchange").notNull(),
  encryptedData: jsonb("encrypted_data").notNull(),
  maskedKey: text("masked_key").notNull(),
  label: text("label").default(""),
  testnet: boolean("testnet").default(false),
  isValid: boolean("is_valid").default(true),
  lastValidated: timestamp("last_validated", { withTimezone: true }).default(sql`NOW()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Strategy Providers ────────────────────────────────────
export const strategyProviders = pgTable("strategy_providers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  contactEmail: text("contact_email").notNull(),
  description: text("description").default(""),
  website: text("website").default(""),
  apiKey: text("api_key").unique().notNull(),
  apiKeyPrefix: text("api_key_prefix").notNull(),
  allowedAssets: text("allowed_assets").array().default(sql`'{BTC,ETH,SOL,BNB}'`),
  maxLeverage: integer("max_leverage").default(5),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  totalSignals: integer("total_signals").default(0),
  winCount: integer("win_count").default(0),
  lossCount: integer("loss_count").default(0),
  totalPnl: numeric("total_pnl").default("0"),
  avgConfidence: numeric("avg_confidence").default("0"),
  lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Treasury Yields ───────────────────────────────────────
export const treasuryYields = pgTable("treasury_yields", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  epoch: integer("epoch").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  startingCapital: numeric("starting_capital").notNull().default("0"),
  endingCapital: numeric("ending_capital").notNull().default("0"),
  grossYield: numeric("gross_yield").notNull().default("0"),
  protocolFee: numeric("protocol_fee").notNull().default("0"),
  netYield: numeric("net_yield").notNull().default("0"),
  apr: numeric("apr").notNull().default("0"),
  tradesExecuted: integer("trades_executed").notNull().default(0),
  winRate: numeric("win_rate").notNull().default("0"),
  distributed: boolean("distributed").notNull().default(false),
  userCount: integer("user_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Revenue Claims ────────────────────────────────────────
export const revenueClaims = pgTable("revenue_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  yieldId: uuid("yield_id").notNull().references(() => treasuryYields.id),
  contributionType: text("contribution_type").notNull(),
  principal: numeric("principal").notNull().default("0"),
  weight: numeric("weight").notNull().default("0"),
  sharePct: numeric("share_pct").notNull().default("0"),
  amount: numeric("amount").notNull().default("0"),
  status: text("status").notNull().default("CLAIMABLE"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Treasury Events ───────────────────────────────────────
export const treasuryEvents = pgTable("treasury_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Treasury State ────────────────────────────────────────
export const treasuryState = pgTable("treasury_state", {
  id: integer("id").primaryKey().default(1),
  totalDeployed: numeric("total_deployed").notNull().default("0"),
  availableBalance: numeric("available_balance").notNull().default("0"),
  totalUnrealizedPnl: numeric("total_unrealized_pnl").notNull().default("0"),
  totalRealizedPnl: numeric("total_realized_pnl").notNull().default("0"),
  utilization: numeric("utilization").notNull().default("0"),
  peakValue: numeric("peak_value").notNull().default("0"),
  currentDrawdown: numeric("current_drawdown").notNull().default("0"),
  killSwitch: boolean("kill_switch").notNull().default(false),
  activePositions: jsonb("active_positions").default([]),
  strategyConfig: jsonb("strategy_config").default({}),
  allocationStrategy: jsonb("allocation_strategy").default({ strategy: 7000, operations: 2000, reserve: 1000 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Vault Deposits ────────────────────────────────────────
export const vaultDeposits = pgTable("vault_deposits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  depositAmount: numeric("deposit_amount").notNull(),
  interestRate: numeric("interest_rate").notNull().default("0"),
  planIndex: integer("plan_index").notNull().default(0),
  depositDate: timestamp("deposit_date", { withTimezone: true }).default(sql`NOW()`),
  maturityDate: timestamp("maturity_date", { withTimezone: true }),
  status: text("status").notNull().default("ACTIVE"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Operation Logs ────────────────────────────────────────
export const operationLogs = pgTable("operation_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUsername: text("admin_username").notNull(),
  adminRole: text("admin_role").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Contract Configs ──────────────────────────────────────
export const contractConfigs = pgTable("contract_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").unique().notNull(),
  value: text("value").notNull().default(""),
  description: text("description").default(""),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Fund Distributions ────────────────────────────────────
export const fundDistributions = pgTable("fund_distributions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull(),
  amount: numeric("amount").notNull(),
  txHash: text("tx_hash"),
  fundManager: text("fund_manager").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("CONFIRMED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Accuracy Daily Snapshots ──────────────────────────────
export const accuracyDailySnapshots = pgTable("accuracy_daily_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  model: text("model").notNull(),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull().default("1H"),
  accuracyPct: numeric("accuracy_pct").notNull().default("0"),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  avgConfidence: numeric("avg_confidence").notNull().default("0"),
  computedWeight: numeric("computed_weight").notNull().default("1.0"),
  avgPriceErrorPct: numeric("avg_price_error_pct").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── AI Training Reports ───────────────────────────────────
export const aiTrainingReports = pgTable("ai_training_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reportDate: date("report_date").notNull(),
  reportType: text("report_type").notNull().default("hourly"),
  totalPredictions: integer("total_predictions").notNull().default(0),
  overallAccuracy: numeric("overall_accuracy").notNull().default("0"),
  modelPerformance: jsonb("model_performance").default([]),
  assetPerformance: jsonb("asset_performance").default([]),
  timeframePerformance: jsonb("timeframe_performance").default([]),
  biasAlerts: jsonb("bias_alerts").default([]),
  degradationAlerts: jsonb("degradation_alerts").default([]),
  tradeAttribution: jsonb("trade_attribution").default([]),
  recommendations: jsonb("recommendations").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ── Simulation Config ─────────────────────────────────────
export const simulationConfig = pgTable("simulation_config", {
  id: integer("id").primaryKey().default(1),
  positionSizeUsd: numeric("position_size_usd").notNull().default("1000"),
  maxPositions: integer("max_positions").notNull().default(15),
  maxLeverage: integer("max_leverage").notNull().default(5),
  maxDrawdownPct: numeric("max_drawdown_pct").notNull().default("10"),
  cooldownMin: integer("cooldown_min").notNull().default(5),
  enabledStrategies: text("enabled_strategies").array().notNull().default(sql`ARRAY['trend_following','mean_reversion','breakout','scalping','momentum','swing']`),
  enabledAssets: text("enabled_assets").array().notNull().default(sql`ARRAY['BTC','ETH','SOL','BNB','DOGE','XRP']`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── User Risk Config ──────────────────────────────────────
export const userRiskConfig = pgTable("user_risk_config", {
  userId: uuid("user_id").primaryKey(),
  maxPositionSizeUsd: numeric("max_position_size_usd").default("1000"),
  maxConcurrentPositions: integer("max_concurrent_positions").default(3),
  maxDailyLossUsd: numeric("max_daily_loss_usd").default("200"),
  maxDrawdownPct: numeric("max_drawdown_pct").default("10"),
  maxLeverage: integer("max_leverage").default(5),
  allowedAssets: text("allowed_assets").array().default(sql`ARRAY['BTC','ETH','SOL','BNB']`),
  copyEnabled: boolean("copy_enabled").default(false),
  executionMode: text("execution_mode").default("PAPER"),
  tradingHoursEnabled: boolean("trading_hours_enabled").default(false),
  tradingHoursStart: integer("trading_hours_start").default(8),
  tradingHoursEnd: integer("trading_hours_end").default(22),
  cooldownMinutes: integer("cooldown_minutes").default(1),
  minSignalStrength: text("min_signal_strength").default("MEDIUM"),
  killSwitch: boolean("kill_switch").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Trade Results ─────────────────────────────────────────
export const tradeResults = pgTable("trade_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: uuid("signal_id").references(() => tradeSignals.id),
  asset: text("asset").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  exitPrice: numeric("exit_price").notNull(),
  size: numeric("size"),
  leverage: integer("leverage").default(1),
  pnlUsd: numeric("pnl_usd").notNull(),
  pnlPct: numeric("pnl_pct").notNull(),
  closeReason: text("close_reason").notNull(),
  durationSeconds: integer("duration_seconds"),
  strategyType: text("strategy_type"),
  contributingModels: text("contributing_models").array(),
  isWin: boolean("is_win").notNull(),
  fees: numeric("fees").default("0"),
  exchange: text("exchange"),
  entryState: jsonb("entry_state"),
  exitState: jsonb("exit_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── User Trade Configs ────────────────────────────────────
export const userTradeConfigs = pgTable("user_trade_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  exchange: text("exchange").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiSecretEncrypted: text("api_secret_encrypted"),
  apiPassphraseEncrypted: text("api_passphrase_encrypted"),
  apiConnected: boolean("api_connected").default(false),
  apiLastTestAt: timestamp("api_last_test_at", { withTimezone: true }),
  modelsFollow: text("models_follow").array().default(sql`ARRAY['GPT-4o','Claude','Gemini','DeepSeek','Llama']`),
  strategiesFollow: text("strategies_follow").array().default(sql`ARRAY['trend_following','mean_reversion','breakout','momentum','scalping']`),
  coinsFollow: text("coins_follow").array().default(sql`ARRAY['BTC','ETH','SOL','BNB','DOGE']`),
  positionSizeUsd: numeric("position_size_usd").default("100"),
  maxLeverage: integer("max_leverage").default(3),
  maxPositions: integer("max_positions").default(5),
  maxDailyLossPct: numeric("max_daily_loss_pct").default("10"),
  stopLossPct: numeric("stop_loss_pct").default("3"),
  takeProfitPct: numeric("take_profit_pct").default("6"),
  trailingStop: boolean("trailing_stop").default(true),
  trailingStopPct: numeric("trailing_stop_pct").default("1.5"),
  executionMode: text("execution_mode").default("paper"),
  nodeType: text("node_type").default("MINI"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Copy Trade Orders ─────────────────────────────────────
export const copyTradeOrders = pgTable("copy_trade_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userWallet: text("user_wallet").notNull(),
  configId: uuid("config_id").references(() => userTradeConfigs.id),
  signalId: uuid("signal_id"),
  primaryModel: text("primary_model"),
  strategyType: text("strategy_type"),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  leverage: integer("leverage").default(1),
  entryPrice: numeric("entry_price"),
  size: numeric("size"),
  sizeUsd: numeric("size_usd"),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  trailingStopTrigger: numeric("trailing_stop_trigger"),
  exchangeOrderId: text("exchange_order_id"),
  exchangeResponse: jsonb("exchange_response"),
  exitPrice: numeric("exit_price"),
  pnlPct: numeric("pnl_pct"),
  pnlUsd: numeric("pnl_usd"),
  feeUsd: numeric("fee_usd"),
  feeCollected: boolean("fee_collected").default(false),
  status: text("status").default("pending"),
  errorMessage: text("error_message"),
  openedAt: timestamp("opened_at", { withTimezone: true }).default(sql`NOW()`),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Copy Trade Daily Stats ────────────────────────────────
export const copyTradeDailyStats = pgTable("copy_trade_daily_stats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userWallet: text("user_wallet").notNull(),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  tradesOpened: integer("trades_opened").default(0),
  tradesClosed: integer("trades_closed").default(0),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  totalPnlUsd: numeric("total_pnl_usd").default("0"),
  totalFeeUsd: numeric("total_fee_usd").default("0"),
  maxDrawdownPct: numeric("max_drawdown_pct").default("0"),
  winRatePct: numeric("win_rate_pct").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── MA Swap Records ───────────────────────────────────────
export const maSwapRecords = pgTable("ma_swap_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  maAmount: numeric("ma_amount").notNull(),
  usdcAmount: numeric("usdc_amount").notNull(),
  maPrice: numeric("ma_price").notNull(),
  txHash: text("tx_hash"),
  status: text("status").default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Active Config ─────────────────────────────────────────
export const activeConfig = pgTable("active_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Weight Adjustment Log ─────────────────────────────────
export const weightAdjustmentLog = pgTable("weight_adjustment_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  modelsAdjusted: integer("models_adjusted"),
  assetsCovered: text("assets_covered").array(),
  totalPredictions: integer("total_predictions"),
  overallAccuracy: numeric("overall_accuracy"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});

// ── Backtest Reports ──────────────────────────────────────
export const backtestReports = pgTable("backtest_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  config: jsonb("config").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  totalTrades: integer("total_trades"),
  winningTrades: integer("winning_trades"),
  losingTrades: integer("losing_trades"),
  winRate: numeric("win_rate"),
  totalPnlUsd: numeric("total_pnl_usd"),
  totalPnlPct: numeric("total_pnl_pct"),
  avgPnlPerTrade: numeric("avg_pnl_per_trade"),
  bestTrade: numeric("best_trade"),
  worstTrade: numeric("worst_trade"),
  sharpeRatio: numeric("sharpe_ratio"),
  maxDrawdownPct: numeric("max_drawdown_pct"),
  maxDrawdownUsd: numeric("max_drawdown_usd"),
  profitFactor: numeric("profit_factor"),
  calmarRatio: numeric("calmar_ratio"),
  avgTradeDuration: integer("avg_trade_duration"),
  byAsset: jsonb("by_asset"),
  byStrategy: jsonb("by_strategy"),
  byCloseReason: jsonb("by_close_reason"),
  previousReportId: uuid("previous_report_id"),
  performanceChange: numeric("performance_change"),
  alert: text("alert"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`),
});
