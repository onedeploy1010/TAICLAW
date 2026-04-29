export const VAULT_CHART_PERIODS = ["7D", "14D", "30D", "ALL"] as const;
export type VaultChartPeriod = (typeof VAULT_CHART_PERIODS)[number];

export const STRATEGY_FILTERS = ["All", "Trending", "Quantitative", "Completed"] as const;
export const PREDICTION_TIMEFRAMES = ["All", "15min", "1H", "4H"] as const;

export const TRADE_ASSETS = ["BTC", "ETH", "SOL", "BNB"] as const;
export const DASHBOARD_ASSETS = ["BTC", "ETH", "BNB", "DOGE", "SOL"] as const;

export const BET_DEFAULTS = {
  minAmount: 1,
  step: 5,
  defaultAmount: 10,
  defaultDuration: "1min",
  payoutPercent: 84,
};

export const PREDICTION_GRID_CONFIG = {
  totalCells: 54,
  columns: 9,
  hitThreshold: 0.6,
  directionThreshold: 0.5,
};

export const VAULT_PLANS = {
  "5_DAYS":   { days: 5,   dailyRate: 0.005, label: "5天",   apr: "182.5%", minAmount: 50, platformFee: 0.10, planIndex: 0 },
  "45_DAYS":  { days: 45,  dailyRate: 0.007, label: "45天",  apr: "255.5%", minAmount: 50, platformFee: 0.10, planIndex: 1 },
  "90_DAYS":  { days: 90,  dailyRate: 0.009, label: "90天",  apr: "328.5%", minAmount: 50, platformFee: 0.10, planIndex: 2 },
  "180_DAYS": { days: 180, dailyRate: 0.012, label: "180天", apr: "438%",   minAmount: 50, platformFee: 0.10, planIndex: 3 },
} as const;


/* ── 节点招募计划（新6档体系）──────────────────────────────────────────── */
export const NODE_PLANS = {
  /** 初级节点 — 1,000 U · 1000 席 */
  BASIC: {
    price: 1000, label: "初级节点", labelEn: "Basic Node",
    capacity: 1000, directRewardRate: 0.05, dividendWeight: 100,
    airdropEmber: 1000,
    features: ["basicStrategies", "communityAccess", "aiApiAccess"],
    frozenAmount: 1000, dailyRate: 0.009, durationDays: 90,
  },
  /** 中级节点 — 2,500 U · 800 席 */
  STANDARD: {
    price: 2500, label: "中级节点", labelEn: "Standard Node",
    capacity: 800, directRewardRate: 0.08, dividendWeight: 120,
    airdropEmber: 3000,
    features: ["basicStrategies", "communityAccess", "aiApiAccess", "copyTrading"],
    frozenAmount: 2500, dailyRate: 0.009, durationDays: 90,
  },
  /** 高级节点 — 5,000 U · 400 席 */
  ADVANCED: {
    price: 5000, label: "高级节点", labelEn: "Advanced Node",
    capacity: 400, directRewardRate: 0.10, dividendWeight: 140,
    airdropEmber: 6250,
    features: ["allStrategies", "aiApiAccess", "copyTrading", "prioritySupport"],
    frozenAmount: 5000, dailyRate: 0.009, durationDays: 90,
  },
  /** 超级节点 — 10,000 U · 200 席 */
  SUPER: {
    price: 10000, label: "超级节点", labelEn: "Super Node",
    capacity: 200, directRewardRate: 0.12, dividendWeight: 160,
    airdropEmber: 13000,
    features: ["allStrategies", "aiApiAccess", "copyTrading", "prioritySupport", "higherVaultYields"],
    frozenAmount: 10000, dailyRate: 0.009, durationDays: 90,
  },
  /** 联创节点 — 50,000 U · 20 席 */
  FOUNDER: {
    price: 50000, label: "联创节点", labelEn: "Founder Node",
    capacity: 20, directRewardRate: 0.15, dividendWeight: 200,
    airdropEmber: 75000,
    features: ["allStrategies", "aiApiAccess", "copyTrading", "prioritySupport", "higherVaultYields", "daoVoting"],
    frozenAmount: 50000, dailyRate: 0.009, durationDays: 90,
  },
  /** 创世节点 — 条件达标 */
  GENESIS: {
    price: 0, label: "创世节点", labelEn: "Genesis Node",
    capacity: null, directRewardRate: 0.15, dividendWeight: 200,
    airdropEmber: 0,
    genesisConditions: [
      "直推3个联创节点（50,000U）",
      "团队内5个联创节点（50,000U）",
      "团队内30个超级节点（10,000U）",
    ],
    features: ["allStrategies", "aiApiAccess", "copyTrading", "prioritySupport", "higherVaultYields", "daoVoting", "coreIncentivePool10%"],
    frozenAmount: 0, dailyRate: 0.009, durationDays: 90,
  },
  /* 旧兼容 — 不在UI显示，仅保持后端数据兼容 */
  MINI: {
    price: 100, label: "标准节点(旧)", labelEn: "Mini Node (legacy)",
    capacity: null, directRewardRate: 0.05, dividendWeight: 100, airdropEmber: 0,
    features: ["basicStrategies"],
    frozenAmount: 1000, dailyRate: 0.009, durationDays: 90,
  },
  MAX: {
    price: 600, label: "超级节点(旧)", labelEn: "Max Node (legacy)",
    capacity: null, directRewardRate: 0.12, dividendWeight: 160, airdropEmber: 0,
    features: ["allStrategiesUnlocked", "prioritySupport"],
    frozenAmount: 6000, dailyRate: 0.009, durationDays: 120,
  },
} as const;

export type NodePlanKey = keyof typeof NODE_PLANS;

/** 6档节点显示顺序（不含旧版兼容） */
export const NODE_PLAN_ORDER: NodePlanKey[] = ["BASIC", "STANDARD", "ADVANCED", "SUPER", "FOUNDER", "GENESIS"];

/* ── 节点分红来源说明 ───────────────────────────────────────────────────── */
export const NODE_DIVIDEND_SOURCES = [
  "外部AI造血净收益",
  "母币买入滑点 2%",
  "子币买入滑点 2%",
  "母币卖出盈利税 5%",
  "子币卖出盈利税 3%",
  "市场沉淀资金收益",
] as const;

/* ── 空投解锁规则 ───────────────────────────────────────────────────────── */
export const AIRDROP_UNLOCK_RULES = [
  { condition: "底池达到 280万U（初始）",      percent: 10 },
  { condition: "底池达到 700万 + 有效质押 ≥10万U", percent: 20 },
  { condition: "底池达到 1750万 + 有效质押 ≥30万U", percent: 30 },
  { condition: "底池达到 3500万 或 开放满 180天", percent: 40 },
] as const;

/* ── V1-V9 推广等级体系 ─────────────────────────────────────────────────── */
export const V_RANKS = [
  { level: "V1", holding: 1000, performance: 20000,  filled: 2,  commission: 0.04, special: null },
  { level: "V2", holding: 1000, performance: 50000,  filled: 0,  commission: 0.08, special: null },
  { level: "V3", holding: 1000, performance: 300000, filled: 5,  commission: 0.12, special: "平级1%" },
  { level: "V4", holding: 2000, performance: 1000000, filled: 7, commission: 0.16, special: null },
  { level: "V5", holding: 3000, performance: 3000000, filled: 10,commission: 0.20, special: null },
  { level: "V6", holding: 4000, performance: 7000000, filled: 13,commission: 0.23, special: "V8沉淀6%+V9沉淀3%" },
  { level: "V7", holding: 5000, performance: 20000000,filled: 15,commission: 0.25, special: "固定沉淀5%" },
  { level: "V8", holding: 10000,performance: 50000000,filled: 15,commission: 0.27, special: "固定沉淀5%" },
  { level: "V9", holding: 20000,performance: 90000000,filled: 15,commission: 0.29, special: "固定沉淀5%+DAO权" },
] as const;

// Vault deposit thresholds to activate node rank
export const NODE_ACTIVATION_TIERS = {
  MINI: [
    { rank: "V1", vaultDeposit: 100, requiredMiniReferrals: 0 },
    { rank: "V2", vaultDeposit: 300, requiredMiniReferrals: 0 },
    { rank: "V3", vaultDeposit: 500, requiredMiniReferrals: 0 },
    { rank: "V4", vaultDeposit: 600, requiredMiniReferrals: 0 },
  ],
  MAX: [
    { rank: "V1", vaultDeposit: 100, requiredMiniReferrals: 3 },
    { rank: "V2", vaultDeposit: 300, requiredMiniReferrals: 0 },
    { rank: "V3", vaultDeposit: 500, requiredMiniReferrals: 0 },
    { rank: "V4", vaultDeposit: 600, requiredMiniReferrals: 0 },
    { rank: "V5", vaultDeposit: 800, requiredMiniReferrals: 0 },
    { rank: "V6", vaultDeposit: 1000, requiredMiniReferrals: 0 },
  ],
} as const;

export const NODE_QUALIFICATION_CHECKS = {
  MINI: [
    { checkDay: 30, requiredRank: "V2", passAction: "UNLOCK_PARTIAL", failAction: "KEEP_LOCKED",
      earningRange: "1-60", desc: "V2达标：解锁1-60天锁仓收益" },
    { checkDay: 90, requiredRank: "V2", passAction: "UNLOCK_ALL", failAction: "DESTROY",
      earningRange: "1-90", desc: "V2达标：解锁全部收益；不达标：收益销毁" },
    { checkDay: 90, requiredRank: "V4", passAction: "UNLOCK_FROZEN", failAction: "KEEP_FROZEN",
      earningRange: null, desc: "V4达标：解锁铸造MA" },
  ],
  MAX: [
    { checkDay: 15, requiredRank: "V1", passAction: "CONTINUE", failAction: "PAUSE",
      earningRange: "16-30", desc: "V1达标：继续领取收益" },
    { checkDay: 30, requiredRank: "V2", passAction: "CONTINUE", failAction: "PAUSE",
      earningRange: "31-60", desc: "V2达标：继续领取收益" },
    { checkDay: 60, requiredRank: "V4", passAction: "CONTINUE", failAction: "PAUSE",
      earningRange: "61-120", desc: "V4达标：继续领取收益" },
    { checkDay: 120, requiredRank: "V6", passAction: "UNLOCK_FROZEN", failAction: "KEEP_FROZEN",
      earningRange: null, desc: "V6达标：解锁铸造MA" },
  ],
} as const;

export const NODE_MILESTONES = {
  MINI: [
    { rank: "V1", days: 0,  unlocks: "activation", desc: "激活节点",     requiredHolding: 100,  requiredReferrals: 0 },
    { rank: "V2", days: 30, unlocks: "earnings",    desc: "解锁1-60天收益", requiredHolding: 300,  requiredReferrals: 0 },
    { rank: "V4", days: 90, unlocks: "earnings_and_package", desc: "解锁全部", requiredHolding: 600, requiredReferrals: 0 },
  ],
  MAX: [
    { rank: "V1", days: 15,  unlocks: "earnings",            desc: "100U+推荐3小节点",   requiredHolding: 100,  requiredReferrals: 3 },
    { rank: "V2", days: 30,  unlocks: "earnings",            desc: "存入金库300U",       requiredHolding: 300,  requiredReferrals: 0 },
    { rank: "V4", days: 60,  unlocks: "earnings",            desc: "存入金库600U",       requiredHolding: 600,  requiredReferrals: 0 },
    { rank: "V6", days: 120, unlocks: "earnings_and_package",desc: "存入1000U解锁全部", requiredHolding: 1000, requiredReferrals: 0 },
  ],
} as const;

export const RANKS = [
  { level: "V1", commission: 0.04 },
  { level: "V2", commission: 0.08 },
  { level: "V3", commission: 0.12 },
  { level: "V4", commission: 0.16 },
  { level: "V5", commission: 0.20 },
  { level: "V6", commission: 0.23 },
  { level: "V7", commission: 0.25 },
  { level: "V8", commission: 0.27 },
  { level: "V9", commission: 0.29 },
] as const;

export const REVENUE_DISTRIBUTION = {
  nodePool: 0.50,
  buybackPool: 0.20,
  insurancePool: 0.10,
  treasuryPool: 0.10,
  operations: 0.10,
} as const;

export const HEDGE_CONFIG = {
  minAmount: 100,
  defaultAmount: "300",
} as const;

export const VIP_PLANS = {
  trial: { price: 0, label: "trial", period: "7 days", days: 7 },
  monthly: { price: 49, label: "monthly", period: "1 month", days: 30 },
  halfyear: { price: 250, label: "halfyear", period: "6 months", days: 180 },
} as const;

export const WITHDRAW_BURN_RATES = [
  { days: 0, burn: 0.20, label: "Immediate" },
  { days: 7, burn: 0.15, label: "7 days" },
  { days: 15, burn: 0.10, label: "15 days" },
  { days: 30, burn: 0.05, label: "30 days" },
  { days: 60, burn: 0.00, label: "60 days" },
] as const;

export const RANK_CONDITIONS = [
  { level: "V1", personalHolding: 100, directReferrals: 1, teamPerformance: 5000 },
  { level: "V2", personalHolding: 300, requiredSubRanks: 2, subRankLevel: "V1", teamPerformance: 20000 },
  { level: "V3", personalHolding: 500, requiredSubRanks: 2, subRankLevel: "V2", teamPerformance: 50000 },
  { level: "V4", personalHolding: 1000, requiredSubRanks: 2, subRankLevel: "V3", teamPerformance: 100000 },
  { level: "V5", personalHolding: 3000, requiredSubRanks: 2, subRankLevel: "V4", teamPerformance: 500000 },
  { level: "V6", personalHolding: 5000, requiredSubRanks: 2, subRankLevel: "V5", teamPerformance: 1000000 },
  { level: "V7", personalHolding: 10000, requiredSubRanks: 2, subRankLevel: "V6", teamPerformance: 3000000 },
] as const;

export const EXCHANGES = [
  { name: "Aster", tag: "Aster" },
  { name: "Hyperliquid", tag: "Hyperliquid" },
  { name: "Binance", tag: "Binance" },
  { name: "OKX", tag: "OKX" },
  { name: "Bybit", tag: "Bybit" },
] as const;

export interface LocalStrategy {
  id: string;
  name: string;
  description: string;
  leverage: string;
  winRateRange: [number, number];    // min, max — floating
  monthlyReturnRange: [number, number]; // min, max — floating
  totalAumRange: [number, number];
  status: string;
  isHot: boolean;
  isVipOnly: boolean;
  type: "hyperliquid" | "openclaw";
  updateIntervalMs: number;          // how often values float
}

export const LOCAL_STRATEGIES: LocalStrategy[] = [
  {
    id: "hyperliquid-vault",
    name: "[Systemic Strategies] HyperGrowth",
    description: "HyperLiquid on-chain vault — 226% APR systematic growth strategy",
    leverage: "3x",
    winRateRange: [76, 82],
    monthlyReturnRange: [16, 22],
    totalAumRange: [7_800_000, 8_400_000],
    status: "ACTIVE",
    isHot: true,
    isVipOnly: false,
    type: "hyperliquid",
    updateIntervalMs: 3600_000, // 1 hour
  },
  {
    id: "openclaw-gpt",
    name: "OpenClaw GPT",
    description: "GPT-powered multi-factor momentum strategy",
    leverage: "5x",
    winRateRange: [80, 88],
    monthlyReturnRange: [22, 26],
    totalAumRange: [1_200_000, 1_800_000],
    status: "ACTIVE",
    isHot: false,
    isVipOnly: false,
    type: "openclaw",
    updateIntervalMs: 7200_000, // 2 hours
  },
  {
    id: "openclaw-gemini",
    name: "OpenClaw Gemini",
    description: "Gemini deep-learning trend-following engine",
    leverage: "5x",
    winRateRange: [83, 87],
    monthlyReturnRange: [25, 29],
    totalAumRange: [900_000, 1_400_000],
    status: "ACTIVE",
    isHot: false,
    isVipOnly: false,
    type: "openclaw",
    updateIntervalMs: 7200_000,
  },
  {
    id: "openclaw-deepseek",
    name: "OpenClaw DeepSeek",
    description: "DeepSeek quantitative analysis with adaptive risk control",
    leverage: "8x",
    winRateRange: [80, 84],
    monthlyReturnRange: [32, 36],
    totalAumRange: [600_000, 1_000_000],
    status: "ACTIVE",
    isHot: true,
    isVipOnly: false,
    type: "openclaw",
    updateIntervalMs: 7200_000,
  },
  {
    id: "openclaw-qwen",
    name: "OpenClaw Claude",
    description: "Claude conservative risk-aware analysis with high precision",
    leverage: "3x",
    winRateRange: [90, 94],
    monthlyReturnRange: [13, 17],
    totalAumRange: [1_500_000, 2_000_000],
    status: "ACTIVE",
    isHot: false,
    isVipOnly: false,
    type: "openclaw",
    updateIntervalMs: 7200_000,
  },
  {
    id: "openclaw-grok",
    name: "OpenClaw Llama",
    description: "Llama mean-reversion + BB squeeze local AI strategy",
    leverage: "5x",
    winRateRange: [87, 91],
    monthlyReturnRange: [18, 22],
    totalAumRange: [800_000, 1_200_000],
    status: "ACTIVE",
    isHot: false,
    isVipOnly: false,
    type: "openclaw",
    updateIntervalMs: 7200_000,
  },
  {
    id: "coinmax-ai",
    name: "TAICLAW AI",
    description: "Multi-model consensus + deep learning meta-strategy",
    leverage: "5x",
    winRateRange: [88, 95] as const,
    monthlyReturnRange: [20, 28] as const,
    totalAumRange: [3_000_000, 5_000_000] as const,
    status: "ACTIVE",
    isHot: true,
    isVipOnly: false,
    type: "openclaw" as const,
    updateIntervalMs: 7200_000,
  },
];

export const SETTINGS_ITEMS = [
  { key: "leaderboard", label: "Leaderboard" },
  { key: "contact-us", label: "Contact Us" },
  { key: "language-settings", label: "Language Settings" },
  { key: "disconnect-wallet", label: "Disconnect Wallet" },
] as const;
