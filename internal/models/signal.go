package models

type Signal struct {
	Symbol  string   `json:"symbol"`
	Side    string   `json:"side"`
	Score   float64  `json:"score"`
	Price   *float64 `json:"price,omitempty"`
	RSI     *float64 `json:"rsi,omitempty"`
	ATR     *float64 `json:"atr,omitempty"`
	EMAFast *float64 `json:"ema_fast,omitempty"`
	EMASlow *float64 `json:"ema_slow,omitempty"`
	SL      *float64 `json:"sl,omitempty"`
	TP      *float64 `json:"tp,omitempty"`
}
