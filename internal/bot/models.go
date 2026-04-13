package bot

import (
	"time"
)

type BotSettings struct {
	UserID               int64     `db:"user_id" json:"user_id"`
	Active               bool      `db:"active" json:"active"`
	PairsWhitelist       []string  `db:"pairs_whitelist" json:"pairs_whitelist"`
	AllPairs             bool      `db:"all_pairs" json:"all_pairs"`
	MinConfidence        int       `db:"min_confidence" json:"min_confidence"`
	MaxPositionPct       float64   `db:"max_position_pct" json:"max_position_pct"`
	DailyLossLimitPct    float64   `db:"daily_loss_limit_pct" json:"daily_loss_limit_pct"`
	TradeType            string    `db:"trade_type" json:"trade_type"`
	BinanceAPIKeyEnc     string    `db:"binance_api_key_enc" json:"-"`
	BinanceAPISecretEnc  string    `db:"binance_api_secret_enc" json:"-"`
	MaskedBinanceAPIKey  string    `db:"-" json:"binance_api_key_masked,omitempty"`
	HasBinanceAPIKey     bool      `db:"-" json:"has_binance_api_key"`
	UpdatedAt            time.Time `db:"updated_at" json:"updated_at"`
}

type BotOrder struct {
	ID              string     `db:"id" json:"id"`
	UserID          int64      `db:"user_id" json:"user_id"`
	SignalID        string     `db:"signal_id" json:"signal_id"`
	Pair            string     `db:"pair" json:"pair"`
	Timeframe       string     `db:"timeframe" json:"timeframe,omitempty"`
	Side            string     `db:"side" json:"side"`
	Quantity        float64    `db:"quantity" json:"quantity"`
	EntryPrice      float64    `db:"entry_price" json:"entry_price"`
	SLPrice         float64    `db:"sl_price" json:"sl_price"`
	TPPrice         float64    `db:"tp_price" json:"tp_price"`
	Status          string     `db:"status" json:"status"`
	ErrorMessage    string     `db:"error_message" json:"error_message,omitempty"`
	ExchangeOrderID string     `db:"exchange_order_id" json:"exchange_order_id,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	FilledPrice     *float64   `db:"filled_price" json:"filled_price,omitempty"`
}

type OrderRequest struct {
	Pair       string  `json:"pair"`
	Side       string  `json:"side"`
	Quantity   float64 `json:"quantity"`
	EntryPrice float64 `json:"entry_price"`
	SLPrice    float64 `json:"sl_price"`
	TPPrice    float64 `json:"tp_price"`
	UserID     int64   `json:"user_id"`
	SignalID   string  `json:"signal_id"`
	TradeType  string  `json:"trade_type,omitempty"`
	Timeframe  string  `json:"timeframe,omitempty"`
}

type OrderResponse struct {
	OrderID      string   `json:"order_id"`
	Status       string   `json:"status"`
	FilledPrice  *float64 `json:"filled_price,omitempty"`
	Error        string   `json:"error,omitempty"`
	ExchangeID   string   `json:"exchange_order_id,omitempty"`
}

type TestConnectionResult struct {
	Success bool   `json:"success"`
	Balance string `json:"balance,omitempty"`
	Error   string `json:"error,omitempty"`
}

type SignalEvent struct {
	SignalID    string   `json:"signal_id"`
	Symbol      string   `json:"symbol"`
	Pair        string   `json:"pair"`
	Timeframe   string   `json:"timeframe,omitempty"`
	Side        string   `json:"side"`
	Edge        string   `json:"edge,omitempty"`
	Confidence  int      `json:"confidence"`
	EntryPrice  float64  `json:"entry_price"`
	ATR         float64  `json:"atr"`
	Price       float64  `json:"price,omitempty"`
	QualityFlags []string `json:"quality_flags,omitempty"`
	CreatedAt   string   `json:"created_at,omitempty"`
}

type BotOrdersPage struct {
	Items []BotOrder `json:"items"`
	Page  int        `json:"page"`
	Limit int        `json:"limit"`
	Total int        `json:"total"`
}
