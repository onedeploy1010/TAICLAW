-- Create a view "ai_predictions" that maps to ai_prediction_records
-- so the frontend API (which queries "ai_predictions") works correctly.
-- Only expose the latest PENDING prediction per asset (dedup by asset).

CREATE OR REPLACE VIEW ai_predictions AS
SELECT
  id,
  asset,
  timeframe,
  model,
  prediction,
  confidence,
  target_price,
  current_price,
  reasoning,
  fear_greed_index,
  NULL::TEXT AS fear_greed_label,
  expires_at,
  created_at
FROM ai_prediction_records
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Grant access via anon and authenticated roles
GRANT SELECT ON ai_predictions TO anon;
GRANT SELECT ON ai_predictions TO authenticated;

-- Also ensure the news-predictions edge function CORS is handled
-- (CORS is handled in the edge function code itself, not in SQL)

-- Ensure prediction_bets has proper RLS for anon read
ALTER TABLE prediction_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prediction_bets_select" ON prediction_bets;
CREATE POLICY "prediction_bets_select" ON prediction_bets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "prediction_bets_insert" ON prediction_bets;
CREATE POLICY "prediction_bets_insert" ON prediction_bets
  FOR INSERT WITH CHECK (true);

-- Ensure paper_trades and trade_signals are readable (for AI Lab)
ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paper_trades_select" ON paper_trades;
CREATE POLICY "paper_trades_select" ON paper_trades
  FOR SELECT USING (true);

ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_signals_select" ON trade_signals;
CREATE POLICY "trade_signals_select" ON trade_signals
  FOR SELECT USING (true);

-- Ensure ai_model_accuracy is readable
ALTER TABLE ai_model_accuracy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_model_accuracy_select" ON ai_model_accuracy;
CREATE POLICY "ai_model_accuracy_select" ON ai_model_accuracy
  FOR SELECT USING (true);
