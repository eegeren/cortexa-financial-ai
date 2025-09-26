run:
	go run ./cmd/api

test:
	go test ./...

migrate:
	psql $$DATABASE_URL -f migrations/001_init.sql

dev:
	air || reflex -r '\.(go)$$' -s -- sh -c 'go run ./cmd/api'
