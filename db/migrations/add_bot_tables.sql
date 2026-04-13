CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bot_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    pairs_whitelist TEXT[] NOT NULL DEFAULT '{BTCUSDT,ETHUSDT,SOLUSDT}',
    all_pairs BOOLEAN NOT NULL DEFAULT FALSE,
    min_confidence INT NOT NULL DEFAULT 65,
    max_position_pct DECIMAL NOT NULL DEFAULT 5,
    daily_loss_limit_pct DECIMAL NOT NULL DEFAULT 3,
    trade_type VARCHAR NOT NULL DEFAULT 'spot',
    binance_api_key_enc TEXT NOT NULL DEFAULT '',
    binance_api_secret_enc TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id TEXT NOT NULL DEFAULT '',
    pair VARCHAR NOT NULL,
    timeframe VARCHAR NOT NULL DEFAULT '1h',
    side VARCHAR NOT NULL,
    quantity DECIMAL NOT NULL,
    entry_price DECIMAL NOT NULL,
    sl_price DECIMAL NOT NULL,
    tp_price DECIMAL NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending',
    error_message TEXT NOT NULL DEFAULT '',
    exchange_order_id TEXT NOT NULL DEFAULT '',
    filled_price DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_orders_user_created_at ON bot_orders(user_id, created_at DESC);
