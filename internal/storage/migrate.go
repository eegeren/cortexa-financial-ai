package storage

import "github.com/jmoiron/sqlx"

func EnsureSchema(db *sqlx.DB) error {
	stmts := []string{
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT ''`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS kvkk_accepted BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS kvkk_accepted_at TIMESTAMP`,
		`UPDATE users SET first_name = '' WHERE first_name IS NULL`,
		`UPDATE users SET last_name = '' WHERE last_name IS NULL`,
		`UPDATE users SET kvkk_accepted = FALSE WHERE kvkk_accepted IS NULL`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	notNullStmts := []string{
		`ALTER TABLE IF EXISTS users ALTER COLUMN first_name SET NOT NULL`,
		`ALTER TABLE IF EXISTS users ALTER COLUMN last_name SET NOT NULL`,
	}
	for _, stmt := range notNullStmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}
