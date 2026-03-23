package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
)

type SignalService struct {
	cfg config.Config
}

func NewSignalService(cfg config.Config) *SignalService {
	return &SignalService{cfg: cfg}
}

type predictReq struct {
	Symbol   string `json:"symbol"`
	Interval string `json:"interval,omitempty"`
	Limit    int    `json:"limit,omitempty"`
}

type predictResp struct {
	OK    bool `json:"ok"`
	Stale bool `json:"stale"`
	Data  *struct {
		Symbol       string   `json:"symbol"`
		Timeframe    string   `json:"timeframe"`
		Trend        string   `json:"trend"`
		Momentum     string   `json:"momentum"`
		Risk         string   `json:"risk"`
		MarketRegime string   `json:"market_regime"`
		QualityFlags []string `json:"quality_flags"`
		Confidence   int      `json:"confidence"`
		Scenario     string   `json:"scenario"`
		Insight      string   `json:"insight"`
		Explanation  string   `json:"explanation"`
		Disclaimer   string   `json:"disclaimer"`
		Indicators   struct {
			EMA20       *float64 `json:"ema20"`
			EMA50       *float64 `json:"ema50"`
			EMA200      *float64 `json:"ema200"`
			RSI         *float64 `json:"rsi"`
			ADX         *float64 `json:"adx"`
			ATR         *float64 `json:"atr"`
			VolumeRatio *float64 `json:"volume_ratio"`
			MACD        struct {
				MACD      *float64 `json:"macd"`
				Signal    *float64 `json:"signal"`
				Histogram *float64 `json:"histogram"`
			} `json:"macd"`
		} `json:"indicators"`
		Levels struct {
			Support    *float64 `json:"support"`
			Resistance *float64 `json:"resistance"`
		} `json:"levels"`
		Price   *float64 `json:"price"`
		RSI     *float64 `json:"rsi"`
		ATR     *float64 `json:"atr"`
		Scoring struct {
			RawScore *float64 `json:"raw_score"`
		} `json:"scoring"`
	} `json:"data"`
	Error string `json:"error"`
	Path  string `json:"path"`
}

type insightResp struct {
	Insight string `json:"insight"`
}

type symbolsResp struct {
	OK       bool     `json:"ok"`
	Symbols  []string `json:"symbols"`
	Provider string   `json:"provider"`
}

type signalScoreBreakdown struct {
	TrendStructureScore             float64
	MomentumConfirmationScore       float64
	TrendStrengthScore              float64
	VolumeParticipationScore        float64
	RegimeScore                     float64
	MultiTimeframeConfirmationScore float64
	FinalScore                      float64
	Confidence                      int
	Risk                            string
	Trend                           string
	Momentum                        string
	MarketRegime                    string
	QualityFlags                    []string
	Side                            string
	CompatibilityScore              float64
}

func (s *SignalService) aiBaseURL() string {
	base := strings.TrimSuffix(s.cfg.AIServiceURL, "/predict")
	if base == "" {
		base = s.cfg.AIServiceURL
	}
	return strings.TrimRight(base, "/")
}

func clampFloat(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func boolToFloat(value bool) float64 {
	if value {
		return 1
	}
	return 0
}

func appendUnique(flags []string, flag string) []string {
	for _, existing := range flags {
		if existing == flag {
			return flags
		}
	}
	return append(flags, flag)
}

func normalizeSigned(value, maxAbs float64) float64 {
	if maxAbs == 0 {
		return 0
	}
	return clampFloat(value/maxAbs, -1, 1)
}

func classifyMomentum(macd, signal, histogram, rsi *float64) string {
	macdUp := macd != nil && signal != nil && *macd > *signal
	macdDown := macd != nil && signal != nil && *macd < *signal
	histUp := histogram != nil && *histogram > 0
	histDown := histogram != nil && *histogram < 0
	rsiHigh := rsi != nil && *rsi >= 55
	rsiLow := rsi != nil && *rsi <= 45

	switch {
	case (macdUp && histUp) || (macdUp && rsiHigh):
		return "Expanding"
	case (macdDown && histDown) || (macdDown && rsiLow):
		return "Weakening"
	default:
		return "Mixed"
	}
}

func classifyRegime(trendStrengthScore, regimeScore, volumeScore float64) string {
	switch {
	case regimeScore <= -10 || trendStrengthScore <= 2:
		return "Range-bound"
	case volumeScore <= 0:
		return "Low participation"
	case trendStrengthScore >= 12 && regimeScore >= 8:
		return "Trend expansion"
	default:
		return "Balanced"
	}
}

func trendLabelFromScore(score float64) string {
	switch {
	case score <= -60:
		return "Strong Bearish"
	case score <= -35:
		return "Bearish"
	case score >= 60:
		return "Strong Bullish"
	case score >= 35:
		return "Bullish"
	default:
		return "Neutral"
	}
}

func riskLabelFromInputs(adx, atr, price, volumeRatio *float64, flags []string, regimeScore float64) string {
	riskPoints := 20.0

	if atr != nil && price != nil && *price > 0 {
		atrPct := (*atr / *price) * 100.0
		switch {
		case atrPct >= 3.5:
			riskPoints += 28
		case atrPct >= 2.2:
			riskPoints += 18
		case atrPct >= 1.1:
			riskPoints += 8
		}
	}

	if volumeRatio != nil {
		switch {
		case *volumeRatio < 0.8:
			riskPoints += 18
		case *volumeRatio < 1.0:
			riskPoints += 10
		case *volumeRatio > 1.6:
			riskPoints -= 6
		}
	}

	if adx != nil {
		switch {
		case *adx < 16:
			riskPoints += 14
		case *adx < 22:
			riskPoints += 8
		case *adx > 32:
			riskPoints -= 4
		}
	}

	if regimeScore <= -10 {
		riskPoints += 12
	}

	for _, flag := range flags {
		switch flag {
		case "high_volatility", "stale_data":
			riskPoints += 10
		case "low_volume", "weak_volume_confirmation", "choppy_structure", "mtf_conflict":
			riskPoints += 8
		case "mtf_aligned":
			riskPoints -= 4
		}
	}

	riskPoints = clampFloat(riskPoints, 0, 100)
	switch {
	case riskPoints >= 60:
		return "High"
	case riskPoints >= 34:
		return "Medium"
	default:
		return "Low"
	}
}

func computeSignalBreakdown(data *struct {
	Symbol       string   `json:"symbol"`
	Timeframe    string   `json:"timeframe"`
	Trend        string   `json:"trend"`
	Momentum     string   `json:"momentum"`
	Risk         string   `json:"risk"`
	MarketRegime string   `json:"market_regime"`
	QualityFlags []string `json:"quality_flags"`
	Confidence   int      `json:"confidence"`
	Scenario     string   `json:"scenario"`
	Insight      string   `json:"insight"`
	Explanation  string   `json:"explanation"`
	Disclaimer   string   `json:"disclaimer"`
	Indicators   struct {
		EMA20       *float64 `json:"ema20"`
		EMA50       *float64 `json:"ema50"`
		EMA200      *float64 `json:"ema200"`
		RSI         *float64 `json:"rsi"`
		ADX         *float64 `json:"adx"`
		ATR         *float64 `json:"atr"`
		VolumeRatio *float64 `json:"volume_ratio"`
		MACD        struct {
			MACD      *float64 `json:"macd"`
			Signal    *float64 `json:"signal"`
			Histogram *float64 `json:"histogram"`
		} `json:"macd"`
	} `json:"indicators"`
	Levels struct {
		Support    *float64 `json:"support"`
		Resistance *float64 `json:"resistance"`
	} `json:"levels"`
	Price   *float64 `json:"price"`
	RSI     *float64 `json:"rsi"`
	ATR     *float64 `json:"atr"`
	Scoring struct {
		RawScore *float64 `json:"raw_score"`
	} `json:"scoring"`
}) signalScoreBreakdown {
	flags := append([]string{}, data.QualityFlags...)
	ema20 := data.Indicators.EMA20
	ema50 := data.Indicators.EMA50
	ema200 := data.Indicators.EMA200
	price := data.Price
	rsi := data.Indicators.RSI
	adx := data.Indicators.ADX
	atr := data.Indicators.ATR
	volumeRatio := data.Indicators.VolumeRatio
	macd := data.Indicators.MACD.MACD
	macdSignal := data.Indicators.MACD.Signal
	macdHistogram := data.Indicators.MACD.Histogram

	trendStructure := 0.0
	if ema20 != nil && ema50 != nil && ema200 != nil {
		switch {
		case *ema20 > *ema50 && *ema50 > *ema200:
			trendStructure += 24
		case *ema20 < *ema50 && *ema50 < *ema200:
			trendStructure -= 24
		case *ema20 > *ema50:
			trendStructure += 10
		case *ema20 < *ema50:
			trendStructure -= 10
		}
	}
	if price != nil {
		if ema20 != nil {
			trendStructure += 6 * normalizeSigned(*price-*ema20, math.Max(math.Abs(*ema20)*0.01, 1))
		}
		if ema50 != nil {
			trendStructure += 8 * normalizeSigned(*price-*ema50, math.Max(math.Abs(*ema50)*0.015, 1))
		}
		if ema200 != nil {
			trendStructure += 10 * normalizeSigned(*price-*ema200, math.Max(math.Abs(*ema200)*0.02, 1))
		}
	}
	trendStructure = clampFloat(trendStructure, -40, 40)

	momentumConfirmation := 0.0
	if macd != nil && macdSignal != nil {
		delta := *macd - *macdSignal
		momentumConfirmation += 14 * normalizeSigned(delta, math.Max(math.Abs(*macdSignal)*0.35, 0.6))
	}
	if macdHistogram != nil {
		momentumConfirmation += 8 * normalizeSigned(*macdHistogram, 0.8)
	}
	if rsi != nil {
		switch {
		case *rsi >= 58:
			momentumConfirmation += 4
		case *rsi >= 52:
			momentumConfirmation += 2
		case *rsi <= 42:
			momentumConfirmation -= 4
		case *rsi <= 48:
			momentumConfirmation -= 2
		}
		if *rsi >= 70 || *rsi <= 30 {
			momentumConfirmation *= 0.85
		}
	}
	momentumConfirmation = clampFloat(momentumConfirmation, -22, 22)

	trendStrength := 0.0
	if adx != nil {
		switch {
		case *adx >= 35:
			trendStrength = 16
		case *adx >= 28:
			trendStrength = 12
		case *adx >= 22:
			trendStrength = 8
		case *adx >= 18:
			trendStrength = 4
		default:
			trendStrength = -6
		}
	} else {
		trendStrength = -2
	}

	volumeParticipation := 0.0
	if volumeRatio != nil {
		switch {
		case *volumeRatio >= 1.8:
			volumeParticipation = 12
		case *volumeRatio >= 1.35:
			volumeParticipation = 8
		case *volumeRatio >= 1.05:
			volumeParticipation = 4
		case *volumeRatio >= 0.9:
			volumeParticipation = -2
		case *volumeRatio >= 0.75:
			volumeParticipation = -8
		default:
			volumeParticipation = -14
		}
	} else {
		volumeParticipation = -4
	}

	regimeScore := 0.0
	if trendStrength <= 0 {
		regimeScore -= 10
		flags = appendUnique(flags, "weak_trend_strength")
	}
	if volumeParticipation <= -8 {
		regimeScore -= 10
		flags = appendUnique(flags, "low_volume")
		flags = appendUnique(flags, "weak_volume_confirmation")
	}
	if math.Abs(trendStructure) < 12 {
		regimeScore -= 10
		flags = appendUnique(flags, "choppy_structure")
	}
	if math.Abs(momentumConfirmation) < 5 {
		regimeScore -= 6
	}
	if trendStrength >= 8 && math.Abs(trendStructure) >= 18 {
		regimeScore += 8
	}
	if volumeParticipation >= 8 {
		regimeScore += 4
	}
	regimeScore = clampFloat(regimeScore, -18, 12)

	multiTimeframeConfirmation := 0.0
	alignedFromFlags := false
	for _, flag := range flags {
		switch flag {
		case "mtf_aligned":
			multiTimeframeConfirmation += 8
			alignedFromFlags = true
		case "mtf_conflict":
			multiTimeframeConfirmation -= 10
		}
	}
	if !alignedFromFlags {
		if trendStrength >= 8 && math.Abs(trendStructure) >= 20 && math.Abs(momentumConfirmation) >= 8 && trendStructure*momentumConfirmation > 0 {
			multiTimeframeConfirmation += 4
		}
		if trendStructure*momentumConfirmation < 0 {
			multiTimeframeConfirmation -= 4
		}
	}
	multiTimeframeConfirmation = clampFloat(multiTimeframeConfirmation, -12, 12)

	finalScore := trendStructure + momentumConfirmation + trendStrength + volumeParticipation + regimeScore + multiTimeframeConfirmation

	if math.Abs(trendStructure) < 14 || trendStructure*momentumConfirmation < 0 {
		finalScore *= 0.7
	}
	if trendStrength <= 0 && math.Abs(finalScore) > 35 {
		finalScore *= 0.8
	}
	if regimeScore <= -10 && math.Abs(finalScore) > 30 {
		finalScore *= 0.78
	}

	finalScore = clampFloat(finalScore, -100, 100)
	trend := trendLabelFromScore(finalScore)
	side := "HOLD"
	if trend == "Bullish" || trend == "Strong Bullish" {
		side = "BUY"
	} else if trend == "Bearish" || trend == "Strong Bearish" {
		side = "SELL"
	}

	qualityPenalty := 0.0
	if volumeParticipation <= -8 {
		qualityPenalty += 14
	}
	if trendStrength <= 0 {
		qualityPenalty += 12
	}
	if regimeScore <= -10 {
		qualityPenalty += 10
	}
	if multiTimeframeConfirmation < 0 {
		qualityPenalty += math.Abs(multiTimeframeConfirmation) * 1.2
	}
	if math.Abs(trendStructure) < 12 {
		qualityPenalty += 10
	}
	confidence := int(math.Round(clampFloat(22+(math.Abs(finalScore)*0.72)-qualityPenalty, 18, 92)))
	risk := riskLabelFromInputs(adx, atr, price, volumeRatio, flags, regimeScore)

	return signalScoreBreakdown{
		TrendStructureScore:             math.Round(trendStructure*10) / 10,
		MomentumConfirmationScore:       math.Round(momentumConfirmation*10) / 10,
		TrendStrengthScore:              math.Round(trendStrength*10) / 10,
		VolumeParticipationScore:        math.Round(volumeParticipation*10) / 10,
		RegimeScore:                     math.Round(regimeScore*10) / 10,
		MultiTimeframeConfirmationScore: math.Round(multiTimeframeConfirmation*10) / 10,
		FinalScore:                      math.Round(finalScore*10) / 10,
		Confidence:                      confidence,
		Risk:                            risk,
		Trend:                           trend,
		Momentum:                        classifyMomentum(macd, macdSignal, macdHistogram, rsi),
		MarketRegime:                    classifyRegime(trendStrength, regimeScore, volumeParticipation),
		QualityFlags:                    flags,
		Side:                            side,
		CompatibilityScore:              math.Round((math.Abs(finalScore)/100.0)*1000) / 1000,
	}
}

type sideBreakdownMetrics struct {
	Trades       int     `json:"trades"`
	NetReturnSum float64 `json:"net_return_sum"`
	HitRate      float64 `json:"hit_rate"`
	AvgReturn    float64 `json:"avg_return"`
	AvgScore     float64 `json:"avg_score"`
}

type weekdayBreakdownRow struct {
	Day          string  `json:"day"`
	Trades       int     `json:"trades"`
	NetReturnSum float64 `json:"net_return_sum"`
	HitRate      float64 `json:"hit_rate"`
	AvgReturn    float64 `json:"avg_return"`
}

type streakMetrics struct {
	LongestWin  int `json:"longest_win"`
	LongestLoss int `json:"longest_loss"`
}

type exposureMetrics struct {
	Bars    int     `json:"bars"`
	Minutes float64 `json:"minutes"`
	Hours   float64 `json:"hours"`
	Days    float64 `json:"days"`
	Ratio   float64 `json:"ratio"`
}

type backtestResp struct {
	Symbol         string  `json:"symbol"`
	Threshold      float64 `json:"threshold"`
	Limit          int     `json:"limit"`
	Horizon        int     `json:"horizon"`
	CommissionBps  float64 `json:"commission_bps"`
	SlippageBps    float64 `json:"slippage_bps"`
	PositionSize   float64 `json:"position_size"`
	Trades         int     `json:"trades"`
	GrossValueSum  float64 `json:"gross_value_sum"`
	NetValueSum    float64 `json:"net_value_sum"`
	GrossReturnSum float64 `json:"gross_return_sum"`
	NetReturnSum   float64 `json:"net_return_sum"`
	HitRate        float64 `json:"hit_rate"`
	CostReturn     float64 `json:"cost_return"`
	History        []struct {
		Time        string  `json:"time"`
		Side        string  `json:"side"`
		Score       float64 `json:"score"`
		FwdReturn   float64 `json:"fwd_return"`
		GrossReturn float64 `json:"gross_return"`
		NetReturn   float64 `json:"net_return"`
		GrossValue  float64 `json:"gross_value"`
		NetValue    float64 `json:"net_value"`
	} `json:"history"`
	EquityCurve []struct {
		Time     string  `json:"time"`
		NetValue float64 `json:"net_value"`
	} `json:"equity_curve"`
	RegimeMetrics []struct {
		VolRegime   string  `json:"vol_regime"`
		TrendRegime string  `json:"trend_regime"`
		Trades      int     `json:"trades"`
		NetReturn   float64 `json:"net_return_sum"`
		HitRate     float64 `json:"hit_rate"`
	} `json:"regime_metrics"`
	Sharpe          float64            `json:"sharpe"`
	Sortino         float64            `json:"sortino"`
	MaxDrawdown     float64            `json:"max_drawdown"`
	AvgWin          float64            `json:"avg_win"`
	AvgLoss         float64            `json:"avg_loss"`
	Expectancy      float64            `json:"expectancy"`
	ProfitFactor    float64            `json:"profit_factor"`
	WinLossRatio    float64            `json:"win_loss_ratio"`
	MedianReturn    float64            `json:"median_return"`
	ReturnStd       float64            `json:"return_std"`
	ReturnQuantiles map[string]float64 `json:"return_quantiles"`
	SideBreakdown   struct {
		Buy  sideBreakdownMetrics `json:"buy"`
		Sell sideBreakdownMetrics `json:"sell"`
	} `json:"side_breakdown"`
	WeekdayBreakdown []weekdayBreakdownRow `json:"weekday_breakdown"`
	Streaks          streakMetrics         `json:"streaks"`
	Exposure         exposureMetrics       `json:"exposure"`
	ScoreBuckets     []struct {
		Bucket       string  `json:"bucket"`
		Trades       int     `json:"trades"`
		NetReturnAvg float64 `json:"net_return_avg"`
		HitRate      float64 `json:"hit_rate"`
	} `json:"score_buckets"`
}

type backtestSweepResp struct {
	Symbol        string         `json:"symbol"`
	Thresholds    []float64      `json:"thresholds"`
	Horizons      []int          `json:"horizons"`
	Limit         int            `json:"limit"`
	CommissionBps float64        `json:"commission_bps"`
	SlippageBps   float64        `json:"slippage_bps"`
	PositionSize  float64        `json:"position_size"`
	Results       []backtestResp `json:"results"`
}

func (s *SignalService) Predict(ctx context.Context, symbol string) (models.Signal, error) {
	body, _ := json.Marshal(predictReq{Symbol: symbol})
	predictURL := s.aiBaseURL() + "/predict"
	log.Printf("signal predict upstream url=%s symbol=%s", predictURL, symbol)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, predictURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("signal predict request failed for %s: %v", symbol, err)
		return models.Signal{}, fmt.Errorf("signal upstream request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		trimmed := strings.TrimSpace(string(msg))
		if trimmed == "" {
			trimmed = "ai service error"
		}
		log.Printf("signal predict non-200 for %s: status=%d body=%s", symbol, resp.StatusCode, trimmed)
		return models.Signal{}, fmt.Errorf("ai service status %d: %s", resp.StatusCode, trimmed)
	}

	var pr predictResp
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		log.Printf("signal predict decode failed for %s: %v", symbol, err)
		return models.Signal{}, fmt.Errorf("ai service decode failed: %w", err)
	}
	if !pr.OK {
		message := strings.TrimSpace(pr.Error)
		if message == "" {
			message = "ai service returned ok=false"
		}
		log.Printf("signal predict upstream not ok for %s: error=%s path=%s stale=%v", symbol, message, pr.Path, pr.Stale)
		return models.Signal{}, fmt.Errorf("ai service unavailable: %s", message)
	}
	if pr.Data == nil {
		log.Printf("signal predict returned empty data for %s: ok=%v stale=%v", symbol, pr.OK, pr.Stale)
		return models.Signal{}, fmt.Errorf("ai service returned empty data")
	}
	if strings.TrimSpace(pr.Data.Symbol) == "" {
		log.Printf("signal predict returned blank symbol for %s: data=%+v", symbol, *pr.Data)
		return models.Signal{}, fmt.Errorf("ai service returned invalid signal payload")
	}
	breakdown := computeSignalBreakdown(pr.Data)

	return models.Signal{
		Symbol:       pr.Data.Symbol,
		Timeframe:    pr.Data.Timeframe,
		Trend:        breakdown.Trend,
		Momentum:     breakdown.Momentum,
		Risk:         breakdown.Risk,
		MarketRegime: breakdown.MarketRegime,
		QualityFlags: breakdown.QualityFlags,
		Confidence:   breakdown.Confidence,
		Scenario:     pr.Data.Scenario,
		Insight:      pr.Data.Insight,
		Explanation:  pr.Data.Explanation,
		Disclaimer:   pr.Data.Disclaimer,
		Indicators: models.SignalIndicators{
			EMA20:       pr.Data.Indicators.EMA20,
			EMA50:       pr.Data.Indicators.EMA50,
			EMA200:      pr.Data.Indicators.EMA200,
			RSI:         pr.Data.Indicators.RSI,
			ADX:         pr.Data.Indicators.ADX,
			ATR:         pr.Data.Indicators.ATR,
			VolumeRatio: pr.Data.Indicators.VolumeRatio,
			MACD: models.SignalMACD{
				MACD:      pr.Data.Indicators.MACD.MACD,
				Signal:    pr.Data.Indicators.MACD.Signal,
				Histogram: pr.Data.Indicators.MACD.Histogram,
			},
		},
		Levels: models.SignalLevels{
			Support:    pr.Data.Levels.Support,
			Resistance: pr.Data.Levels.Resistance,
		},
		Scoring: models.SignalScoringComponents{
			TrendStructureScore:             breakdown.TrendStructureScore,
			MomentumConfirmationScore:       breakdown.MomentumConfirmationScore,
			TrendStrengthScore:              breakdown.TrendStrengthScore,
			VolumeParticipationScore:        breakdown.VolumeParticipationScore,
			RegimeScore:                     breakdown.RegimeScore,
			MultiTimeframeConfirmationScore: breakdown.MultiTimeframeConfirmationScore,
		},
		Side:       breakdown.Side,
		Score:      breakdown.CompatibilityScore,
		FinalScore: breakdown.FinalScore,
		Price:      pr.Data.Price,
		RSI:        pr.Data.RSI,
		ATR:        pr.Data.ATR,
	}, nil
}

func (s *SignalService) Symbols(ctx context.Context) ([]string, error) {
	symbolsURL := s.aiBaseURL() + "/market/symbols"
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, symbolsURL, nil)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("symbol upstream request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		trimmed := strings.TrimSpace(string(msg))
		if trimmed == "" {
			trimmed = "ai service error"
		}
		return nil, fmt.Errorf("ai service status %d: %s", resp.StatusCode, trimmed)
	}

	var sr symbolsResp
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		return nil, fmt.Errorf("ai service decode failed: %w", err)
	}

	seen := make(map[string]struct{}, len(sr.Symbols))
	symbols := make([]string, 0, len(sr.Symbols))
	for _, symbol := range sr.Symbols {
		normalized := strings.ToUpper(strings.TrimSpace(symbol))
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		symbols = append(symbols, normalized)
	}
	sort.Strings(symbols)
	if len(symbols) == 0 {
		return nil, fmt.Errorf("ai service returned empty symbols list")
	}

	return symbols, nil
}

func (s *SignalService) Insight(ctx context.Context, payload map[string]any) (string, error) {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, s.aiBaseURL()+"/insight", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("signal insight request failed: %v", err)
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(resp.Body)
		trimmed := strings.TrimSpace(string(msg))
		if trimmed == "" {
			trimmed = "ai insight service error"
		}
		log.Printf("signal insight non-200: status=%d body=%s", resp.StatusCode, trimmed)
		return "", fmt.Errorf("ai insight service status %d: %s", resp.StatusCode, trimmed)
	}

	var ir insightResp
	if err := json.NewDecoder(resp.Body).Decode(&ir); err != nil {
		log.Printf("signal insight decode failed: %v", err)
		return "", err
	}
	return strings.TrimSpace(ir.Insight), nil
}

func (s *SignalService) Backtest(
	ctx context.Context,
	symbol string,
	threshold float64,
	limit, horizon int,
	commissionBps, slippageBps, positionSize float64,
) (backtestResp, error) {
	var resp backtestResp
	endpoint, _ := url.Parse(s.aiBaseURL() + "/backtest")
	q := endpoint.Query()
	q.Set("symbol", symbol)
	q.Set("threshold", formatFloat(threshold))
	q.Set("limit", formatInt(limit))
	q.Set("horizon", formatInt(horizon))
	q.Set("commission_bps", formatFloat(commissionBps))
	q.Set("slippage_bps", formatFloat(slippageBps))
	q.Set("position_size", formatFloat(positionSize))
	endpoint.RawQuery = q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return resp, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return resp, httpError(res)
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return resp, err
	}
	return resp, nil
}

func (s *SignalService) BacktestSweep(
	ctx context.Context,
	symbol string,
	thresholds []float64,
	horizons []int,
	limit int,
	commissionBps, slippageBps, positionSize float64,
) (backtestSweepResp, error) {
	var resp backtestSweepResp
	endpoint, _ := url.Parse(s.aiBaseURL() + "/backtest/sweep")
	q := endpoint.Query()
	q.Set("symbol", symbol)
	q.Set("thresholds", joinFloat(thresholds))
	q.Set("horizons", joinInt(horizons))
	q.Set("limit", formatInt(limit))
	q.Set("commission_bps", formatFloat(commissionBps))
	q.Set("slippage_bps", formatFloat(slippageBps))
	q.Set("position_size", formatFloat(positionSize))
	endpoint.RawQuery = q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return resp, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return resp, httpError(res)
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return resp, err
	}
	return resp, nil
}

func formatFloat(v float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.4f", v), "0"), ".")
}

func formatInt(v int) string {
	return fmt.Sprintf("%d", v)
}

func joinFloat(values []float64) string {
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = formatFloat(v)
	}
	return strings.Join(parts, ",")
}

func joinInt(values []int) string {
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = formatInt(v)
	}
	return strings.Join(parts, ",")
}

func httpError(res *http.Response) error {
	var payload struct {
		Message string `json:"message"`
	}
	_ = json.NewDecoder(res.Body).Decode(&payload)
	if payload.Message != "" {
		return fmt.Errorf(payload.Message)
	}
	return fmt.Errorf("ai service status %d", res.StatusCode)
}
