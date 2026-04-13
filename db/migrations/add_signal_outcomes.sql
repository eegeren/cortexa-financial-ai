CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair VARCHAR NOT NULL,
    timeframe VARCHAR NOT NULL,
    edge VARCHAR NOT NULL,
    confidence_score INT NOT NULL,
    price DECIMAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    pair VARCHAR NOT NULL,
    timeframe VARCHAR NOT NULL,
    edge VARCHAR NOT NULL,
    confidence_score INT NOT NULL,
    entry_price DECIMAL NOT NULL,
    check_price DECIMAL,
    price_change_pct DECIMAL,
    outcome VARCHAR NOT NULL DEFAULT 'pending',
    checked_at TIMESTAMPTZ,
    check_due_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_outcome_created_at ON signal_outcomes(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_check_due_at_pending ON signal_outcomes(check_due_at) WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_pair_timeframe_created_at ON signal_outcomes(pair, timeframe, created_at DESC);

CREATE TABLE IF NOT EXISTS signal_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR NOT NULL DEFAULT 'overall',
    bucket VARCHAR NOT NULL DEFAULT '',
    pair VARCHAR NOT NULL DEFAULT '',
    timeframe VARCHAR NOT NULL DEFAULT '',
    edge VARCHAR NOT NULL DEFAULT '',
    total_signals INT NOT NULL DEFAULT 0,
    win_count INT NOT NULL DEFAULT 0,
    loss_count INT NOT NULL DEFAULT 0,
    win_rate DECIMAL NOT NULL DEFAULT 0,
    avg_win_pct DECIMAL NOT NULL DEFAULT 0,
    avg_loss_pct DECIMAL NOT NULL DEFAULT 0,
    best_pair VARCHAR NOT NULL DEFAULT '',
    worst_pair VARCHAR NOT NULL DEFAULT '',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_stats_scope_dims
    ON signal_stats(scope, bucket, pair, timeframe, edge);
