package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr                  string
	DBURL                     string
	RedisURL                  string
	JWTSecret                 string
	AIServiceURL              string // Python FastAPI /predict
	BinanceAPIKey             string
	BinanceSecret             string
	BinanceBaseURL            string // e.g. https://api.binance.com
	BinanceKlinesPath         string
	BinanceFallbackURL        string
	BinanceFallbackKlinesPath string
	OwnerEmail                string
	OwnerEmails               []string
	PremiumDisabled           bool

	// AI assistant
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OpenAIModel   string

	// Billing / payments
	PaymentProvider           string
	StripeSecretKey           string
	StripeWebhookSecret       string
	PaddleAPIKey              string
	PaddleEnvironment         string
	PaddleWebhookSecret       string
	LemonSqueezyAPIKey        string
	LemonSqueezyWebhookSecret string
	LemonSqueezyStoreID       string
	IyzicoAPIKey              string
	IyzicoSecretKey           string
	IyzicoWebhookSecret       string
	DefaultTrialDays          int
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if parsed, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return parsed
		}
	}
	return def
}

func getenvBool(k string, def bool) bool {
	if v := os.Getenv(k); v != "" {
		trimmed := strings.TrimSpace(strings.ToLower(v))
		if trimmed == "1" || trimmed == "true" || trimmed == "yes" || trimmed == "on" {
			return true
		}
		if trimmed == "0" || trimmed == "false" || trimmed == "no" || trimmed == "off" {
			return false
		}
	}
	return def
}

// resolveAddr: HTTP_ADDR > PORT (Railway/Render) > :8080
func resolveAddr() string {
	if v := strings.TrimSpace(os.Getenv("HTTP_ADDR")); v != "" {
		return v
	}
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		return ":" + port
	}
	return ":8080"
}

func Load() Config {
	cfg := Config{
		HTTPAddr:                  resolveAddr(),
		DBURL:                     strings.TrimSpace(getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/cta?sslmode=disable")),
		RedisURL:                  strings.TrimSpace(getenv("REDIS_URL", "")),
		JWTSecret:                 strings.TrimSpace(getenv("JWT_SECRET", "dev_secret_change_me")),
		AIServiceURL:              strings.TrimSpace(getenv("AI_SERVICE_URL", "http://localhost:8001/predict")),
		BinanceAPIKey:             strings.TrimSpace(getenv("BINANCE_API_KEY", "")),
		BinanceSecret:             strings.TrimSpace(getenv("BINANCE_API_SECRET", "")),
		BinanceBaseURL:            strings.TrimSpace(getenv("BINANCE_BASE_URL", "https://api.binance.com")),
		BinanceKlinesPath:         strings.TrimSpace(getenv("BINANCE_KLINES_PATH", "/api/v3/klines")),
		BinanceFallbackURL:        strings.TrimSpace(getenv("BINANCE_FALLBACK_URL", "https://data-api.binance.vision")),
		BinanceFallbackKlinesPath: strings.TrimSpace(getenv("BINANCE_FALLBACK_KLINES_PATH", "/api/v3/klines")),
		OwnerEmail:                strings.TrimSpace(getenv("OWNER_EMAIL", "yusufegeeren@cortexaai.net")),
		OpenAIAPIKey:              strings.TrimSpace(getenv("OPENAI_API_KEY", "")),
		OpenAIBaseURL:             strings.TrimSpace(getenv("OPENAI_BASE_URL", "https://api.openai.com")),
		OpenAIModel:               strings.TrimSpace(getenv("OPENAI_MODEL", "gpt-4o-mini")),
		PaymentProvider:           strings.TrimSpace(strings.ToLower(getenv("PAYMENT_PROVIDER", "stripe"))),
		StripeSecretKey:           strings.TrimSpace(getenv("STRIPE_SECRET_KEY", "")),
		StripeWebhookSecret:       strings.TrimSpace(getenv("STRIPE_WEBHOOK_SECRET", "")),
		PaddleAPIKey:              strings.TrimSpace(getenv("PADDLE_API_KEY", "")),
		PaddleEnvironment:         strings.TrimSpace(strings.ToLower(getenv("PADDLE_ENV", "sandbox"))),
		PaddleWebhookSecret:       strings.TrimSpace(getenv("PADDLE_WEBHOOK_SECRET", "")),
		LemonSqueezyAPIKey:        strings.TrimSpace(getenv("LEMONSQUEEZY_API_KEY", "")),
		LemonSqueezyWebhookSecret: strings.TrimSpace(getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")),
		LemonSqueezyStoreID:       strings.TrimSpace(getenv("LEMONSQUEEZY_STORE_ID", "")),
		IyzicoAPIKey:              strings.TrimSpace(getenv("IYZICO_API_KEY", "")),
		IyzicoSecretKey:           strings.TrimSpace(getenv("IYZICO_SECRET_KEY", "")),
		IyzicoWebhookSecret:       strings.TrimSpace(getenv("IYZICO_WEBHOOK_SECRET", "")),
		DefaultTrialDays:          getenvInt("TRIAL_DAYS", 7),
		PremiumDisabled:           getenvBool("PREMIUM_DISABLED", true),
	}

	ownerList := []string{}
	if list := strings.TrimSpace(getenv("OWNER_EMAILS", "")); list != "" {
		for _, item := range strings.Split(list, ",") {
			item = strings.TrimSpace(item)
			if item != "" {
				ownerList = append(ownerList, item)
			}
		}
	}
	if cfg.OwnerEmail != "" {
		ownerList = append(ownerList, cfg.OwnerEmail)
	}
	cfg.OwnerEmails = ownerList

	if cfg.JWTSecret == "dev_secret_change_me" {
		log.Println("[WARN] using default JWT secret. Set JWT_SECRET in production.")
	}

	return cfg
}

func (cfg Config) IsOwnerEmail(email string) bool {
	if strings.TrimSpace(email) == "" {
		return false
	}
	for _, owner := range cfg.OwnerEmails {
		if strings.EqualFold(strings.TrimSpace(owner), strings.TrimSpace(email)) {
			return true
		}
	}
	return false
}
