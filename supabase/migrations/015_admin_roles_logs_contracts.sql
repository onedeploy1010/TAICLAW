-- ═══════════════════════════════════════════════════════════════
-- Migration 015: Admin roles, operation logs, contract configs
-- ═══════════════════════════════════════════════════════════════

-- A) Add role column to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'support';

-- B) Operation logs table
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON operation_logs(action);

-- C) Contract configs table
CREATE TABLE IF NOT EXISTS contract_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D) Seed contract configs
INSERT INTO contract_configs (key, value, description) VALUES
  ('USDT_ADDRESS', '0x55d398326f99059fF775485246999027B3197955', 'USDT合约地址 (BSC)'),
  ('VAULT_CONTRACT', '', '金库合约地址'),
  ('NODE_CONTRACT', '0x941C3A9459cEe89644996d48A640544DA202ae35', '节点合约地址'),
  ('VIP_CONTRACT', '', 'VIP合约地址'),
  ('VIP_RECEIVER', '', 'VIP收款地址'),
  ('CHAIN_ID', '56', '链ID (56=BSC)'),
  ('USDT_DECIMALS', '18', 'USDT小数位')
ON CONFLICT (key) DO NOTHING;

-- E) Set initial roles (adjust as needed)
-- UPDATE admin_users SET role = 'superadmin' WHERE username = 'admin';
-- UPDATE admin_users SET role = 'admin' WHERE username IN ('admin001','admin002','admin003');
-- UPDATE admin_users SET role = 'support' WHERE username IN ('admin004','admin005');
