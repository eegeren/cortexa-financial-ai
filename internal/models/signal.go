package models

type SignalMACD struct {
	MACD      *float64 `json:"macd,omitempty"`
	Signal    *float64 `json:"signal,omitempty"`
	Histogram *float64 `json:"histogram,omitempty"`
}

type SignalIndicators struct {
	EMA20       *float64   `json:"ema20,omitempty"`
	EMA50       *float64   `json:"ema50,omitempty"`
	EMA200      *float64   `json:"ema200,omitempty"`
	RSI         *float64   `json:"rsi,omitempty"`
	MACD        SignalMACD `json:"macd"`
	ADX         *float64   `json:"adx,omitempty"`
	ATR         *float64   `json:"atr,omitempty"`
	VolumeRatio *float64   `json:"volume_ratio,omitempty"`
}

type SignalLevels struct {
	Support    *float64 `json:"support,omitempty"`
	Resistance *float64 `json:"resistance,omitempty"`
}

type SignalScoringComponents struct {
	TrendStructureScore             float64 `json:"trend_structure_score,omitempty"`
	MomentumConfirmationScore       float64 `json:"momentum_confirmation_score,omitempty"`
	TrendStrengthScore              float64 `json:"trend_strength_score,omitempty"`
	VolumeParticipationScore        float64 `json:"volume_participation_score,omitempty"`
	RegimeScore                     float64 `json:"regime_score,omitempty"`
	MultiTimeframeConfirmationScore float64 `json:"multi_timeframe_confirmation_score,omitempty"`
}

type Signal struct {
	Symbol       string                  `json:"symbol"`
	Timeframe    string                  `json:"timeframe,omitempty"`
	Trend        string                  `json:"trend,omitempty"`
	Sentiment    string                  `json:"sentiment,omitempty"`
	Edge         string                  `json:"edge,omitempty"`
	EdgeReason   string                  `json:"edge_reason,omitempty"`
	Momentum     string                  `json:"momentum,omitempty"`
	Risk         string                  `json:"risk,omitempty"`
	MarketRegime string                  `json:"market_regime,omitempty"`
	QualityFlags []string                `json:"quality_flags,omitempty"`
	Confidence   int                     `json:"confidence,omitempty"`
	Scenario     string                  `json:"scenario,omitempty"`
	Insight      string                  `json:"insight,omitempty"`
	Explanation  string                  `json:"explanation,omitempty"`
	Disclaimer   string                  `json:"disclaimer,omitempty"`
	Indicators   SignalIndicators        `json:"indicators"`
	Levels       SignalLevels            `json:"levels"`
	Scoring      SignalScoringComponents `json:"scoring,omitempty"`
	Side         string                  `json:"side"`
	Score        float64                 `json:"score"`
	FinalScore   float64                 `json:"final_score,omitempty"`
	Price        *float64                `json:"price,omitempty"`
	RSI          *float64                `json:"rsi,omitempty"`
	ATR          *float64                `json:"atr,omitempty"`
	EMAFast      *float64                `json:"ema_fast,omitempty"`
	EMASlow      *float64                `json:"ema_slow,omitempty"`
	SL           *float64                `json:"sl,omitempty"`
	TP           *float64                `json:"tp,omitempty"`
	Usage        *SignalUsage            `json:"usage,omitempty"`
}

type SignalUsage struct {
	Used      int    `json:"used"`
	Limit     int    `json:"limit"`
	Remaining int    `json:"remaining"`
	IsPremium bool   `json:"is_premium"`
	ResetAt   string `json:"reset_at,omitempty"`
}
