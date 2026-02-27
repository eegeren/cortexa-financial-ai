ALTER TABLE users
    ADD COLUMN first_name TEXT,
    ADD COLUMN last_name TEXT,
    ADD COLUMN phone TEXT,
    ADD COLUMN kvkk_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN kvkk_accepted_at TIMESTAMP;

UPDATE users SET first_name = '' WHERE first_name IS NULL;
UPDATE users SET last_name = '' WHERE last_name IS NULL;

ALTER TABLE users
    ALTER COLUMN first_name SET NOT NULL,
    ALTER COLUMN last_name SET NOT NULL;
