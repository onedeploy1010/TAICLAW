// Convert snake_case DB rows to camelCase for frontend
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

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

async function apiPost(path: string, body: any) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

async function apiPatch(path: string, body: any) {
  return apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
}

async function apiDelete(path: string) {
  return apiFetch(path, { method: "DELETE" });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function adminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; role?: string }> {
  try {
    const result = await apiPost("/api/admin/login", { username, password });
    return result;
  } catch {
    return { success: false, error: "Invalid username or password" };
  }
}

// ── Operation Logs ────────────────────────────────────────────────────────────
export async function adminAddLog(
  adminUsername: string,
  adminRole: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, any>
) {
  await apiPost("/api/admin/logs", { adminUsername, adminRole, action, targetType, targetId, details });
}

export async function adminGetLogs(page: number, pageSize: number, actionFilter?: string) {
  const url = actionFilter
    ? `/api/admin/logs?page=${page}&pageSize=${pageSize}&action=${encodeURIComponent(actionFilter)}`
    : `/api/admin/logs?page=${page}&pageSize=${pageSize}`;
  return apiFetch(url);
}

// ── Contract Configs ──────────────────────────────────────────────────────────
export async function adminGetContractConfigs() {
  return apiFetch("/api/admin/contract-configs");
}

export async function adminUpdateContractConfig(key: string, value: string, adminUsername: string) {
  return apiPatch(`/api/admin/contract-configs/${encodeURIComponent(key)}`, { value, updatedBy: adminUsername });
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function adminGetProfiles(page: number, pageSize: number, search?: string) {
  const url = search
    ? `/api/admin/profiles?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
    : `/api/admin/profiles?page=${page}&pageSize=${pageSize}`;
  return apiFetch(url);
}

// ── Referrals ─────────────────────────────────────────────────────────────────
export async function adminGetReferralPairs(page: number, pageSize: number) {
  return apiFetch(`/api/admin/referral-pairs?page=${page}&pageSize=${pageSize}`);
}

export interface ReferralNode {
  id: string;
  walletAddress: string;
  rank: string;
  nodeType: string | null;
  refCode: string;
  createdAt: string;
  childCount: number;
  children: ReferralNode[];
}

export async function adminGetReferralTree(walletAddress: string): Promise<ReferralNode | null> {
  return apiFetch(`/api/admin/referral-tree/${encodeURIComponent(walletAddress)}`);
}

export async function adminGetChildren(parentId: string): Promise<ReferralNode[]> {
  return apiFetch(`/api/admin/referral-children/${encodeURIComponent(parentId)}`);
}

export async function adminGetUserTeamStats(userId: string) {
  return apiFetch(`/api/admin/user-team-stats/${encodeURIComponent(userId)}`);
}

// ── Vault Positions ───────────────────────────────────────────────────────────
export async function adminGetVaultPositions(page: number, pageSize: number, status?: string) {
  const url = status
    ? `/api/admin/vault-positions?page=${page}&pageSize=${pageSize}&status=${encodeURIComponent(status)}`
    : `/api/admin/vault-positions?page=${page}&pageSize=${pageSize}`;
  return apiFetch(url);
}

// ── Node Memberships ──────────────────────────────────────────────────────────
export async function adminGetNodeMemberships(page: number, pageSize: number) {
  return apiFetch(`/api/admin/node-memberships?page=${page}&pageSize=${pageSize}`);
}

// ── Performance Stats ─────────────────────────────────────────────────────────
export async function adminGetPerformanceStats() {
  return apiFetch("/api/admin/performance-stats");
}

// ── Commissions ───────────────────────────────────────────────────────────────
export async function adminGetCommissions(page: number, pageSize: number) {
  return apiFetch(`/api/admin/commissions?page=${page}&pageSize=${pageSize}`);
}

// ── Auth Codes ────────────────────────────────────────────────────────────────
export async function adminGetAuthCodes(page: number, pageSize: number, statusFilter?: string) {
  const url = statusFilter && statusFilter !== "ALL"
    ? `/api/admin/auth-codes?page=${page}&pageSize=${pageSize}&status=${encodeURIComponent(statusFilter)}`
    : `/api/admin/auth-codes?page=${page}&pageSize=${pageSize}`;
  return apiFetch(url);
}

export async function adminCreateAuthCode(code: string, nodeType: string, createdBy: string) {
  return apiPost("/api/admin/auth-codes", { code, nodeType, createdBy });
}

function generateRandomCode(_prefix: string): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function adminBatchCreateAuthCodes(count: number, nodeType: string, prefix: string, createdBy: string) {
  const codes = Array.from({ length: count }, () => ({
    code: generateRandomCode(prefix),
    nodeType,
    createdBy,
  }));
  return apiPost("/api/admin/auth-codes/batch", { codes, nodeType, createdBy });
}

export async function adminDeactivateAuthCode(id: string) {
  return apiPatch(`/api/admin/auth-codes/${encodeURIComponent(id)}/deactivate`, {});
}

export async function adminGetAuthCodeStats() {
  return apiFetch("/api/admin/auth-code-stats");
}

// ── Admin Users ───────────────────────────────────────────────────────────────
export async function adminGetAdminUsers() {
  return apiFetch("/api/admin/admin-users");
}

export async function adminCreateAdminUser(username: string, password: string, role: string) {
  return apiPost("/api/admin/admin-users", { username, password, role });
}

export async function adminUpdateAdminUser(id: string, updates: { role?: string; is_active?: boolean; password?: string }) {
  return apiPatch(`/api/admin/admin-users/${encodeURIComponent(id)}`, updates);
}

export async function adminDeleteAdminUser(id: string) {
  return apiDelete(`/api/admin/admin-users/${encodeURIComponent(id)}`);
}

// ── Node Fund Records ─────────────────────────────────────────────────────────
export async function adminGetNodeFundRecords(page: number, pageSize: number) {
  return apiFetch(`/api/admin/node-fund-records?page=${page}&pageSize=${pageSize}`);
}

export async function adminGetNodeFundStats() {
  return apiFetch("/api/admin/node-fund-stats");
}

// ── Fund Distributions ────────────────────────────────────────────────────────
export async function adminGetFundDistributions(page: number, pageSize: number) {
  return apiFetch(`/api/admin/fund-distributions?page=${page}&pageSize=${pageSize}`);
}

export async function adminGetFundDistributionStats() {
  return apiFetch("/api/admin/fund-distribution-stats");
}

// ── Strategy Providers ────────────────────────────────────────────────────────
export async function adminGetStrategyProviders() {
  return apiFetch("/api/admin/strategy-providers");
}

export async function adminUpdateStrategyProvider(id: string, updates: any) {
  return apiPatch(`/api/admin/strategy-providers/${encodeURIComponent(id)}`, updates);
}

// ── AI Stats ──────────────────────────────────────────────────────────────────
export async function adminGetAiStats(asset?: string) {
  const url = asset ? `/api/admin/ai-stats?asset=${encodeURIComponent(asset)}` : "/api/admin/ai-stats";
  return apiFetch(url);
}

export async function adminGetAccuracySnapshots(asset?: string) {
  const url = asset ? `/api/admin/accuracy-snapshots?asset=${encodeURIComponent(asset)}` : "/api/admin/accuracy-snapshots";
  return apiFetch(url);
}

export async function adminGetTrainingReport() {
  return apiFetch("/api/admin/training-report");
}

export async function adminGetWeightAdjustmentLog() {
  return apiFetch("/api/admin/weight-adjustment-log");
}

// ── Paper Trade Stats ─────────────────────────────────────────────────────────
export async function adminGetPaperTradeStats() {
  return apiFetch("/api/admin/paper-trade-stats");
}

export async function adminUpdateSimulationConfig(config: any) {
  return apiPatch("/api/admin/simulation-config", config);
}

// ── Copy Trading Admin ────────────────────────────────────────────────────────
export async function adminGetUserRiskConfigs() {
  return apiFetch("/api/admin/user-risk-configs");
}

export async function adminGetExchangeKeys() {
  return apiFetch("/api/admin/exchange-keys");
}

// ── Treasury / Bridge ─────────────────────────────────────────────────────────
export async function adminGetTreasuryConfig() {
  return apiFetch("/api/admin/treasury-config");
}

export async function adminUpdateTreasuryConfig(key: string, value: string) {
  return apiPatch(`/api/admin/treasury-config/${encodeURIComponent(key)}`, { value });
}

export async function adminGetBridgeCycles() {
  return apiFetch("/api/admin/bridge-cycles");
}

export async function adminCreateBridgeCycle(data: any) {
  return apiPost("/api/admin/bridge-cycles", data);
}

export async function adminGetVaultDeposits(limit = 30) {
  return apiFetch(`/api/admin/vault-deposits?limit=${limit}`);
}

export async function adminGetTransactions(page: number, pageSize: number, types?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (types) params.set("types", types);
  if (search) params.set("search", search);
  return apiFetch(`/api/admin/transactions?${params}`);
}
