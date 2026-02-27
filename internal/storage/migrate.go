package storage

import "github.com/jmoiron/sqlx"

func EnsureSchema(db *sqlx.DB) error {
	stmts := []string{
		// Temel tablolar – billing tablolarından önce oluşturulmalı
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
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`,
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
        INSERT INTO plans (code, name, description, amount_cents, currency, billing_interval, features, active)
        VALUES
            ('starter', 'Starter', 'Essential AI signals for getting started', 3900, 'usd', 'monthly', ARRAY['Up to 50 AI chats/mo', 'Signals for top 5 markets'], TRUE),
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
