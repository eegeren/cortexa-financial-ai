package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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
		Symbol       string `json:"symbol"`
		Timeframe    string `json:"timeframe"`
		Trend        string `json:"trend"`
		Momentum     string `json:"momentum"`
		Risk         string `json:"risk"`
		MarketRegime string `json:"market_regime"`
		QualityFlags []string `json:"quality_flags"`
		Confidence   int    `json:"confidence"`
		Scenario     string `json:"scenario"`
		Insight      string `json:"insight"`
		Explanation  string `json:"explanation"`
		Disclaimer   string `json:"disclaimer"`
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

func (s *SignalService) aiBaseURL() string {
	base := strings.TrimSuffix(s.cfg.AIServiceURL, "/predict")
	if base == "" {
		base = s.cfg.AIServiceURL
	}
	return strings.TrimRight(base, "/")
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
	log.Printf("signal predict upstream url for %s: %s", symbol, predictURL)
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
	score := float64(pr.Data.Confidence) / 100.0
	side := "HOLD"
	switch pr.Data.Trend {
	case "Bullish", "Strong Bullish":
		side = "BUY"
	case "Bearish", "Strong Bearish":
		side = "SELL"
	}

	return models.Signal{
		Symbol:       pr.Data.Symbol,
		Timeframe:    pr.Data.Timeframe,
		Trend:        pr.Data.Trend,
		Momentum:     pr.Data.Momentum,
		Risk:         pr.Data.Risk,
		MarketRegime: pr.Data.MarketRegime,
		QualityFlags: pr.Data.QualityFlags,
		Confidence:   pr.Data.Confidence,
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
		Side:  side,
		Score: score,
		Price: pr.Data.Price,
		RSI:   pr.Data.RSI,
		ATR:   pr.Data.ATR,
	}, nil
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
