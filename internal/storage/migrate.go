package storage

import "github.com/jmoiron/sqlx"

func EnsureSchema(db *sqlx.DB) error {
	stmts := []string{
		// Temel tablolar – billing tablolarından önce oluşturulmalı
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
		`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS trades (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
            qty DOUBLE PRECISION NOT NULL,
            price DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS signals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pair VARCHAR NOT NULL,
            timeframe VARCHAR NOT NULL,
            edge VARCHAR NOT NULL,
            confidence_score INT NOT NULL,
            price DECIMAL NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS signal_outcomes (
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
        )`,
		`CREATE TABLE IF NOT EXISTS signal_stats (
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
        )`,
		`CREATE TABLE IF NOT EXISTS forum_threads (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            topic TEXT NOT NULL,
            author TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS forum_comments (
            id SERIAL PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            username TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS forum_votes (
            id SERIAL PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vote_type TEXT NOT NULL CHECK (vote_type IN ('bullish','bearish','chop')),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(thread_id, user_id)
        )`,
		`CREATE TABLE IF NOT EXISTS signal_daily_usage (
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            usage_date DATE NOT NULL,
            analyses_used INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, usage_date)
        )`,
		`CREATE TABLE IF NOT EXISTS plans (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            amount_cents BIGINT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'usd',
            billing_interval TEXT NOT NULL DEFAULT 'monthly',
            features TEXT[] NOT NULL DEFAULT '{}',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS bot_settings (
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
        )`,
		`CREATE TABLE IF NOT EXISTS bot_orders (
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
        )`,
		`CREATE TABLE IF NOT EXISTS billing_profiles (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            country TEXT NOT NULL DEFAULT '',
            vat_id TEXT NOT NULL DEFAULT '',
            company_name TEXT NOT NULL DEFAULT '',
            address_line1 TEXT NOT NULL DEFAULT '',
            address_line2 TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            postal_code TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_id BIGINT NOT NULL REFERENCES plans(id),
            status TEXT NOT NULL DEFAULT 'trialing',
            trial_ends_at TIMESTAMP WITH TIME ZONE,
            current_period_start TIMESTAMP WITH TIME ZONE,
            current_period_end TIMESTAMP WITH TIME ZONE,
            provider_customer_id TEXT NOT NULL DEFAULT '',
            provider_subscription_id TEXT NOT NULL DEFAULT '' UNIQUE,
            cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT subscriptions_user_unique UNIQUE(user_id)
        )`,
		`CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            provider_invoice_id TEXT NOT NULL UNIQUE,
            amount_cents BIGINT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'usd',
            status TEXT NOT NULL DEFAULT 'open',
            hosted_invoice_url TEXT NOT NULL DEFAULT '',
            pdf_url TEXT NOT NULL DEFAULT '',
            tax_amount_cents BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            issued_at TIMESTAMP WITH TIME ZONE,
            due_at TIMESTAMP WITH TIME ZONE
        )`,
		`CREATE TABLE IF NOT EXISTS payment_events (
            id SERIAL PRIMARY KEY,
            provider TEXT NOT NULL,
            event_id TEXT NOT NULL UNIQUE,
            received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id)`,
		`CREATE INDEX IF NOT EXISTS idx_forum_comments_thread_id ON forum_comments(thread_id)`,
		`CREATE INDEX IF NOT EXISTS idx_forum_votes_thread_id ON forum_votes(thread_id)`,
		`CREATE INDEX IF NOT EXISTS idx_signal_daily_usage_user_date ON signal_daily_usage(user_id, usage_date)`,
		`CREATE INDEX IF NOT EXISTS idx_signals_pair_timeframe_created_at ON signals(pair, timeframe, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_signal_outcomes_outcome_created_at ON signal_outcomes(outcome, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_signal_outcomes_check_due_at_pending ON signal_outcomes(check_due_at) WHERE outcome = 'pending'`,
		`CREATE INDEX IF NOT EXISTS idx_signal_outcomes_pair_timeframe_created_at ON signal_outcomes(pair, timeframe, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_bot_orders_user_created_at ON bot_orders(user_id, created_at DESC)`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_stats_scope_dims ON signal_stats(scope, bucket, pair, timeframe, edge)`,
		`ALTER TABLE IF EXISTS bot_settings ADD COLUMN IF NOT EXISTS all_pairs BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE IF EXISTS bot_orders ADD COLUMN IF NOT EXISTS timeframe VARCHAR NOT NULL DEFAULT '1h'`,
		`ALTER TABLE IF EXISTS bot_orders ADD COLUMN IF NOT EXISTS exchange_order_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE IF EXISTS bot_orders ADD COLUMN IF NOT EXISTS filled_price DECIMAL`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT ''`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS kvkk_accepted BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS kvkk_accepted_at TIMESTAMP`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	notNullStmts := []string{
		`UPDATE users SET first_name = '' WHERE first_name IS NULL`,
		`UPDATE users SET last_name = '' WHERE last_name IS NULL`,
		`UPDATE users SET kvkk_accepted = FALSE WHERE kvkk_accepted IS NULL`,
		`ALTER TABLE IF EXISTS users ALTER COLUMN first_name SET NOT NULL`,
		`ALTER TABLE IF EXISTS users ALTER COLUMN last_name SET NOT NULL`,
	}

	for _, stmt := range notNullStmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	if _, err := db.Exec(`
        INSERT INTO forum_threads (id, title, topic, author, created_at, updated_at)
        VALUES
            ('t1', 'Desk brief: BTC volatility regimes for the New York session', 'Announcements', 'cortexa-desk', NOW(), NOW()),
            ('t2', 'Strategy share: multi-timeframe ladder for SOL after CPI print', 'Strategy', 'liquidity_hunter', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
            ('t3', 'Automation recipe: webhook triggers for ETH basis trades', 'Automation', 'ops', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
            ('t4', 'Support: Binance automation credentials rotate after restart', 'Support', 'flowstate', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            topic = EXCLUDED.topic,
            author = EXCLUDED.author;
    `); err != nil {
		return err
	}

	if _, err := db.Exec(`
        INSERT INTO plans (code, name, description, amount_cents, currency, billing_interval, features, active)
        VALUES
            ('starter', 'Starter', 'Essential AI signals for getting started', 0, 'usd', 'monthly', ARRAY['Limited signal access', 'Basic AI context', 'Core markets only', 'Read-only community'], TRUE),
            ('premium', 'Premium', 'Full signal access and advanced AI intelligence', 1599, 'usd', 'monthly', ARRAY['Full signal access', 'Advanced AI explanations', 'Access to all markets', 'Community participation', 'Early features'], TRUE),
            ('pro', 'Pro', 'Full access to trading intelligence and automations', 9900, 'usd', 'monthly', ARRAY['Unlimited AI chats', 'Advanced signals & backtests', 'Priority support'], TRUE),
            ('enterprise', 'Enterprise', 'Custom SLAs, seats and integrations', 24900, 'usd', 'monthly', ARRAY['Unlimited seats', 'Custom integrations', 'Dedicated success manager'], TRUE)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            amount_cents = EXCLUDED.amount_cents,
            currency = EXCLUDED.currency,
            billing_interval = EXCLUDED.billing_interval,
            features = EXCLUDED.features,
            active = EXCLUDED.active,
            updated_at = NOW();
    `); err != nil {
		return err
	}

	return nil
}
