CREATE TABLE optimized_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair VARCHAR NOT NULL,
  timeframe VARCHAR NOT NULL,
  params JSONB NOT NULL,
  win_rate DECIMAL,
  profit_factor DECIMAL,
  sharpe_ratio DECIMAL,
  max_drawdown_pct DECIMAL,
  total_signals INT,
  overfitting_flag BOOLEAN DEFAULT false,
  optimized_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pair, timeframe)
);

CREATE INDEX ON optimized_params(pair, timeframe);
