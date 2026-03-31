-- =============================================
-- Rename AR token references to MA token
-- =============================================

-- Rename system_config keys
UPDATE system_config SET key = 'MA_TOKEN_PRICE' WHERE key = 'AR_TOKEN_PRICE';
UPDATE system_config SET key = 'MA_PRICE_SOURCE' WHERE key = 'AR_PRICE_SOURCE';
