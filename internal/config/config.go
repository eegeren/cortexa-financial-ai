package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr       string
	DBURL          string
	RedisURL       string
	JWTSecret      string
	AIServiceURL   string // Python FastAPI /predict
	BinanceAPIKey  string
	BinanceSecret  string
	BinanceBaseURL string // e.g. https://api.binance.com
	OwnerEmail     string
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func Load() Config {
	cfg := Config{
		HTTPAddr:       getenv("HTTP_ADDR", ":8080"),
		DBURL:          getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/cta?sslmode=disable"),
		RedisURL:       getenv("REDIS_URL", ""),
		JWTSecret:      getenv("JWT_SECRET", "dev_secret_change_me"),
		AIServiceURL:   getenv("AI_SERVICE_URL", "http://localhost:8001/predict"),
		BinanceAPIKey:  getenv("BINANCE_API_KEY", ""),
		BinanceSecret:  getenv("BINANCE_API_SECRET", ""),
		BinanceBaseURL: getenv("BINANCE_BASE_URL", "https://api.binance.com"),
		OwnerEmail:     getenv("OWNER_EMAIL", "yusufegeeren@cortexaai.net"),
	}
	cfg.AIServiceURL = strings.TrimSpace(cfg.AIServiceURL)
	cfg.HTTPAddr = strings.TrimSpace(cfg.HTTPAddr)
	cfg.DBURL = strings.TrimSpace(cfg.DBURL)
	cfg.RedisURL = strings.TrimSpace(cfg.RedisURL)
	cfg.JWTSecret = strings.TrimSpace(cfg.JWTSecret)
	cfg.BinanceAPIKey = strings.TrimSpace(cfg.BinanceAPIKey)
	cfg.BinanceSecret = strings.TrimSpace(cfg.BinanceSecret)
	cfg.BinanceBaseURL = strings.TrimSpace(cfg.BinanceBaseURL)
	cfg.OwnerEmail = strings.TrimSpace(cfg.OwnerEmail)
	if cfg.JWTSecret == "dev_secret_change_me" {
		log.Println("[WARN] using default JWT secret. Set JWT_SECRET in production.")
	}
	return cfg
}
