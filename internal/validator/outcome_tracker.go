package validator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	botpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/bot"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/jmoiron/sqlx"
	redis "github.com/redis/go-redis/v9"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type OutcomeTracker struct {
	db        *sqlx.DB
	cfg       config.Config
	redis     *redis.Client
	logger    *zap.Logger
	http      *http.Client
	priceBase string
}

type StatsOverview struct {
	Period            string          `json:"period"`
	TotalSignals      int             `json:"total_signals"`
	WinCount          int             `json:"win_count"`
	LossCount         int             `json:"loss_count"`
	BreakevenCount    int             `json:"breakeven_count"`
	WinRate           float64         `json:"win_rate"`
	AvgWinPct         float64         `json:"avg_win_pct"`
	AvgLossPct        float64         `json:"avg_loss_pct"`
	DataSufficient    bool            `json:"data_sufficient"`
	Trend             []DailyWinRate  `json:"trend"`
	CalculatedAt      string          `json:"calculated_at"`
}

type DailyWinRate struct {
	Day     string  `json:"day"`
	WinRate float64 `json:"win_rate"`
	Total   int     `json:"total"`
}

type PairStat struct {
	Pair         string  `json:"pair"`
	TotalSignals int     `json:"total_signals"`
	WinCount     int     `json:"win_count"`
	LossCount    int     `json:"loss_count"`
	WinRate      float64 `json:"win_rate"`
	AvgWinPct    float64 `json:"avg_win_pct"`
}

type TimeframeStat struct {
	Timeframe    string  `json:"timeframe"`
	TotalSignals int     `json:"total_signals"`
	WinCount     int     `json:"win_count"`
	LossCount    int     `json:"loss_count"`
	WinRate      float64 `json:"win_rate"`
}

type ConfidenceStat struct {
	Bucket       string  `json:"bucket"`
	TotalSignals int     `json:"total_signals"`
	WinCount     int     `json:"win_count"`
	LossCount    int     `json:"loss_count"`
	WinRate      float64 `json:"win_rate"`
}

type RecentOutcome struct {
	Pair            string  `json:"pair"`
	Timeframe       string  `json:"timeframe"`
	Edge            string  `json:"edge"`
	ConfidenceScore int     `json:"confidence_score"`
	EntryPrice      float64 `json:"entry_price"`
	CheckPrice      float64 `json:"check_price"`
	PriceChangePct  float64 `json:"price_change_pct"`
	Outcome         string  `json:"outcome"`
	CheckedAt       string  `json:"checked_at"`
	CreatedAt       string  `json:"created_at"`
}

func NewOutcomeTracker(db *sqlx.DB, cfg config.Config, logger *zap.Logger) *OutcomeTracker {
	if logger == nil {
		logger = zap.NewNop()
	}
	tracker := &OutcomeTracker{
		db:        db,
		cfg:       cfg,
		logger:    logger,
		http:      &http.Client{Timeout: 10 * time.Second},
		priceBase: strings.TrimRight(cfg.BinanceBaseURL, "/"),
	}
	if tracker.priceBase == "" {
		tracker.priceBase = "https://api.binance.com"
	}
	if strings.TrimSpace(cfg.RedisURL) != "" {
		if opts, err := redis.ParseURL(strings.TrimSpace(cfg.RedisURL)); err == nil {
			tracker.redis = redis.NewClient(opts)
		} else {
			tracker.redis = redis.NewClient(&redis.Options{Addr: strings.TrimSpace(cfg.RedisURL)})
		}
	}
	return tracker
}

func (t *OutcomeTracker) Start(ctx context.Context) error {
	measurementTicker := time.NewTicker(5 * time.Minute)
	statsTicker := time.NewTicker(1 * time.Hour)
	defer measurementTicker.Stop()
	defer statsTicker.Stop()

	var signalChannel <-chan *redis.Message
	var pubsub *redis.PubSub
	if t.redis != nil {
		pubsub = t.redis.Subscribe(ctx, "signals:new")
		defer pubsub.Close()
		signalChannel = pubsub.Channel()
	}

	t.logger.Info("outcome_tracker_started")
	for {
		select {
		case <-ctx.Done():
			t.logger.Info("outcome_tracker_stopped")
			return ctx.Err()
		case <-measurementTicker.C:
			if err := t.ProcessPendingOutcomes(context.Background()); err != nil {
				t.logger.Warn("outcome_tracker_process_pending_failed", zap.Error(err))
			}
		case <-statsTicker.C:
			if err := t.RefreshStatsCaches(context.Background()); err != nil {
				t.logger.Warn("outcome_tracker_refresh_stats_failed", zap.Error(err))
			}
		case msg, ok := <-signalChannel:
			if signalChannel == nil {
				continue
			}
			if !ok {
				signalChannel = nil
				continue
			}
			var event botpkg.SignalEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				t.logger.Warn("outcome_tracker_signal_decode_failed", zap.Error(err))
				continue
			}
			if err := t.TrackSignalOutcome(context.Background(), event); err != nil {
				t.logger.Warn("outcome_tracker_track_signal_failed", zap.Error(err), zap.String("pair", event.Pair))
			}
		}
	}
}

func normalizePair(value string) string {
	return strings.ToUpper(strings.TrimSpace(strings.ReplaceAll(value, "/", "")))
}

func normalizeEdge(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	switch {
	case trimmed == "buy" || trimmed == "long" || strings.Contains(trimmed, "bull"):
		return "long"
	case trimmed == "sell" || trimmed == "short" || strings.Contains(trimmed, "bear"):
		return "short"
	default:
		return "none"
	}
}

func dueDurationForTimeframe(timeframe string) time.Duration {
	switch strings.ToLower(strings.TrimSpace(timeframe)) {
	case "1s", "1h":
		return 4 * time.Hour
	case "4s", "4h":
		return 24 * time.Hour
	case "1g", "1d":
		return 5 * 24 * time.Hour
	default:
		return 4 * time.Hour
	}
}

func confidenceBucket(value int) string {
	switch {
	case value >= 80:
		return "80+"
	case value >= 65:
		return "65-80"
	default:
		return "50-65"
	}
}

func (t *OutcomeTracker) RecordSignal(ctx context.Context, pair, timeframe, edge string, confidenceScore int, price float64, createdAt time.Time) (string, error) {
	if price <= 0 {
		return "", fmt.Errorf("signal price required")
	}
	var id string
	err := t.db.GetContext(ctx, &id, `
		INSERT INTO signals (pair, timeframe, edge, confidence_score, price, created_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id
	`, normalizePair(pair), strings.TrimSpace(timeframe), normalizeEdge(edge), confidenceScore, price, createdAt.UTC())
	return id, err
}

func (t *OutcomeTracker) TrackSignalOutcome(ctx context.Context, event botpkg.SignalEvent) error {
	edge := normalizeEdge(firstNonEmpty(event.Edge, event.Side))
	if edge != "long" && edge != "short" {
		return nil
	}
	createdAt := time.Now().UTC()
	if parsed, err := time.Parse(time.RFC3339, event.CreatedAt); err == nil {
		createdAt = parsed.UTC()
	}
	checkDueAt := createdAt.Add(dueDurationForTimeframe(firstNonEmpty(event.Timeframe, "1h")))
	_, err := t.db.ExecContext(ctx, `
		INSERT INTO signal_outcomes (
			signal_id, pair, timeframe, edge, confidence_score, entry_price, outcome, check_due_at, created_at
		)
		SELECT $1, $2, $3, $4, $5, $6, 'pending', $7, $8
		WHERE NOT EXISTS (SELECT 1 FROM signal_outcomes WHERE signal_id = $1)
	`, event.SignalID, normalizePair(firstNonEmpty(event.Pair, event.Symbol)), firstNonEmpty(event.Timeframe, "1h"), edge, event.Confidence, event.EntryPrice, checkDueAt, createdAt)
	return err
}

func (t *OutcomeTracker) fetchCurrentPrice(ctx context.Context, pair string) (float64, error) {
	endpoint := fmt.Sprintf("%s/api/v3/ticker/price?symbol=%s", t.priceBase, normalizePair(pair))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}
	resp, err := t.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("ticker price status %d", resp.StatusCode)
	}
	var payload struct {
		Price string `json:"price"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}
	var price float64
	if _, err := fmt.Sscanf(payload.Price, "%f", &price); err != nil {
		return 0, err
	}
	return price, nil
}

func classifyOutcome(edge string, changePct float64) string {
	switch edge {
	case "long":
		switch {
		case changePct > 0.5:
			return "win"
		case changePct < -0.5:
			return "loss"
		default:
			return "breakeven"
		}
	case "short":
		switch {
		case changePct < -0.5:
			return "win"
		case changePct > 0.5:
			return "loss"
		default:
			return "breakeven"
		}
	default:
		return "pending"
	}
}

func (t *OutcomeTracker) ProcessPendingOutcomes(ctx context.Context) error {
	rows := []struct {
		ID              string    `db:"id"`
		Pair            string    `db:"pair"`
		Edge            string    `db:"edge"`
		EntryPrice      float64   `db:"entry_price"`
		ConfidenceScore int       `db:"confidence_score"`
		CheckDueAt      time.Time `db:"check_due_at"`
	}{}
	if err := t.db.SelectContext(ctx, &rows, `
		SELECT id, pair, edge, entry_price, confidence_score, check_due_at
		FROM signal_outcomes
		WHERE outcome = 'pending' AND check_due_at <= NOW()
		ORDER BY check_due_at ASC
		LIMIT 100
	`); err != nil {
		return err
	}

	for _, row := range rows {
		price, err := t.fetchCurrentPrice(ctx, row.Pair)
		if err != nil {
			t.logger.Warn("outcome_tracker_fetch_price_failed", zap.Error(err), zap.String("pair", row.Pair))
			continue
		}
		changePct := ((price - row.EntryPrice) / row.EntryPrice) * 100
		if math.IsNaN(changePct) || math.IsInf(changePct, 0) {
			continue
		}
		outcome := classifyOutcome(strings.ToLower(strings.TrimSpace(row.Edge)), changePct)
		if _, err := t.db.ExecContext(ctx, `
			UPDATE signal_outcomes
			SET check_price = $2,
			    price_change_pct = $3,
			    outcome = $4,
			    checked_at = NOW()
			WHERE id = $1
		`, row.ID, price, changePct, outcome); err != nil {
			t.logger.Warn("outcome_tracker_update_failed", zap.Error(err), zap.String("id", row.ID))
		}
	}
	return nil
}

func periodStart(period string) *time.Time {
	now := time.Now().UTC()
	switch strings.ToLower(strings.TrimSpace(period)) {
	case "7d":
		value := now.AddDate(0, 0, -7)
		return &value
	case "30d":
		value := now.AddDate(0, 0, -30)
		return &value
	default:
		return nil
	}
}

func (t *OutcomeTracker) cacheGet(ctx context.Context, key string, target any) bool {
	if t.redis == nil {
		return false
	}
	value, err := t.redis.Get(ctx, key).Result()
	if err != nil || value == "" {
		return false
	}
	return json.Unmarshal([]byte(value), target) == nil
}

func (t *OutcomeTracker) cacheSet(ctx context.Context, key string, payload any) {
	if t.redis == nil {
		return
	}
	bytes, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_ = t.redis.Set(ctx, key, bytes, time.Hour).Err()
}

func (t *OutcomeTracker) Overview(ctx context.Context, period string) (StatsOverview, error) {
	cacheKey := "stats:overview:" + strings.ToLower(firstNonEmpty(period, "all"))
	var cached StatsOverview
	if t.cacheGet(ctx, cacheKey, &cached) {
		return cached, nil
	}

	startedAt := periodStart(period)
	queryFilter := "WHERE outcome IN ('win','loss','breakeven')"
	args := []any{}
	if startedAt != nil {
		queryFilter += " AND created_at >= $1"
		args = append(args, startedAt.UTC())
	}

	var row struct {
		TotalSignals   int     `db:"total_signals"`
		WinCount       int     `db:"win_count"`
		LossCount      int     `db:"loss_count"`
		BreakevenCount int     `db:"breakeven_count"`
		WinRate        float64 `db:"win_rate"`
		AvgWinPct      float64 `db:"avg_win_pct"`
		AvgLossPct     float64 `db:"avg_loss_pct"`
	}
	query := fmt.Sprintf(`
		SELECT
			COUNT(*) AS total_signals,
			COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END), 0) AS win_count,
			COALESCE(SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END), 0) AS loss_count,
			COALESCE(SUM(CASE WHEN outcome = 'breakeven' THEN 1 ELSE 0 END), 0) AS breakeven_count,
			COALESCE(AVG(CASE WHEN outcome = 'win' THEN 100.0 ELSE NULL END), 0) AS win_rate,
			COALESCE(AVG(CASE WHEN outcome = 'win' THEN price_change_pct ELSE NULL END), 0) AS avg_win_pct,
			COALESCE(AVG(CASE WHEN outcome = 'loss' THEN price_change_pct ELSE NULL END), 0) AS avg_loss_pct
		FROM signal_outcomes
		%s
	`, queryFilter)
	if err := t.db.GetContext(ctx, &row, query, args...); err != nil {
		return StatsOverview{}, err
	}
	if row.TotalSignals > 0 {
		row.WinRate = (float64(row.WinCount) / float64(row.TotalSignals)) * 100
	}

	trend := []DailyWinRate{}
	trendQuery := "SELECT DATE(created_at) AS day, COUNT(*) AS total, COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END),0) AS win_count FROM signal_outcomes WHERE outcome IN ('win','loss','breakeven')"
	trendArgs := []any{}
	if startedAt != nil {
		trendQuery += " AND created_at >= $1"
		trendArgs = append(trendArgs, startedAt.UTC())
	} else {
		trendQuery += " AND created_at >= NOW() - INTERVAL '30 days'"
	}
	trendQuery += " GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC"
	trendRows := []struct {
		Day      time.Time `db:"day"`
		Total    int       `db:"total"`
		WinCount int       `db:"win_count"`
	}{}
	if err := t.db.SelectContext(ctx, &trendRows, trendQuery, trendArgs...); err == nil {
		for _, item := range trendRows {
			winRate := 0.0
			if item.Total > 0 {
				winRate = (float64(item.WinCount) / float64(item.Total)) * 100
			}
			trend = append(trend, DailyWinRate{Day: item.Day.Format("2006-01-02"), WinRate: winRate, Total: item.Total})
		}
	}

	overview := StatsOverview{
		Period:         firstNonEmpty(period, "all"),
		TotalSignals:   row.TotalSignals,
		WinCount:       row.WinCount,
		LossCount:      row.LossCount,
		BreakevenCount: row.BreakevenCount,
		WinRate:        row.WinRate,
		AvgWinPct:      row.AvgWinPct,
		AvgLossPct:     row.AvgLossPct,
		DataSufficient: row.TotalSignals >= 50,
		Trend:          trend,
		CalculatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	t.cacheSet(ctx, cacheKey, overview)
	return overview, nil
}

func (t *OutcomeTracker) ByPair(ctx context.Context) ([]PairStat, error) {
	cacheKey := "stats:by-pair"
	var cached []PairStat
	if t.cacheGet(ctx, cacheKey, &cached) {
		return cached, nil
	}
	rows := []PairStat{}
	err := t.db.SelectContext(ctx, &rows, `
		SELECT pair,
		       COUNT(*) AS total_signals,
		       COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END), 0) AS win_count,
		       COALESCE(SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END), 0) AS loss_count,
		       COALESCE(AVG(CASE WHEN outcome = 'win' THEN price_change_pct ELSE NULL END), 0) AS avg_win_pct,
		       COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) AS win_rate
		FROM signal_outcomes
		WHERE outcome IN ('win','loss','breakeven')
		GROUP BY pair
		ORDER BY win_rate DESC, total_signals DESC
	`)
	if err != nil {
		return nil, err
	}
	t.cacheSet(ctx, cacheKey, rows)
	return rows, nil
}

func (t *OutcomeTracker) ByTimeframe(ctx context.Context) ([]TimeframeStat, error) {
	cacheKey := "stats:by-timeframe"
	var cached []TimeframeStat
	if t.cacheGet(ctx, cacheKey, &cached) {
		return cached, nil
	}
	rows := []TimeframeStat{}
	err := t.db.SelectContext(ctx, &rows, `
		SELECT timeframe,
		       COUNT(*) AS total_signals,
		       COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END), 0) AS win_count,
		       COALESCE(SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END), 0) AS loss_count,
		       COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) AS win_rate
		FROM signal_outcomes
		WHERE outcome IN ('win','loss','breakeven')
		GROUP BY timeframe
		ORDER BY timeframe ASC
	`)
	if err != nil {
		return nil, err
	}
	t.cacheSet(ctx, cacheKey, rows)
	return rows, nil
}

func (t *OutcomeTracker) ByConfidence(ctx context.Context) ([]ConfidenceStat, error) {
	cacheKey := "stats:by-confidence"
	var cached []ConfidenceStat
	if t.cacheGet(ctx, cacheKey, &cached) {
		return cached, nil
	}
	rows := []struct {
		Bucket       string  `db:"bucket"`
		TotalSignals int     `db:"total_signals"`
		WinCount     int     `db:"win_count"`
		LossCount    int     `db:"loss_count"`
		WinRate      float64 `db:"win_rate"`
	}{}
	err := t.db.SelectContext(ctx, &rows, `
		SELECT
			CASE
				WHEN confidence_score >= 80 THEN '80+'
				WHEN confidence_score >= 65 THEN '65-80'
				ELSE '50-65'
			END AS bucket,
			COUNT(*) AS total_signals,
			COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END), 0) AS win_count,
			COALESCE(SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END), 0) AS loss_count,
			COALESCE(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) AS win_rate
		FROM signal_outcomes
		WHERE outcome IN ('win','loss','breakeven')
		GROUP BY bucket
		ORDER BY CASE bucket WHEN '50-65' THEN 1 WHEN '65-80' THEN 2 ELSE 3 END
	`)
	if err != nil {
		return nil, err
	}
	result := make([]ConfidenceStat, 0, len(rows))
	for _, row := range rows {
		result = append(result, ConfidenceStat(row))
	}
	t.cacheSet(ctx, cacheKey, result)
	return result, nil
}

func (t *OutcomeTracker) RecentOutcomes(ctx context.Context, limit int) ([]RecentOutcome, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	cacheKey := fmt.Sprintf("stats:recent:%d", limit)
	var cached []RecentOutcome
	if t.cacheGet(ctx, cacheKey, &cached) {
		return cached, nil
	}
	rows := []struct {
		Pair            string         `db:"pair"`
		Timeframe       string         `db:"timeframe"`
		Edge            string         `db:"edge"`
		ConfidenceScore int            `db:"confidence_score"`
		EntryPrice      float64        `db:"entry_price"`
		CheckPrice      sql.NullFloat64 `db:"check_price"`
		PriceChangePct  sql.NullFloat64 `db:"price_change_pct"`
		Outcome         string         `db:"outcome"`
		CheckedAt       sql.NullTime   `db:"checked_at"`
		CreatedAt       time.Time      `db:"created_at"`
	}{}
	err := t.db.SelectContext(ctx, &rows, `
		SELECT pair, timeframe, edge, confidence_score, entry_price, check_price, price_change_pct, outcome, checked_at, created_at
		FROM signal_outcomes
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	items := make([]RecentOutcome, 0, len(rows))
	for _, row := range rows {
		items = append(items, RecentOutcome{
			Pair:            row.Pair,
			Timeframe:       row.Timeframe,
			Edge:            row.Edge,
			ConfidenceScore: row.ConfidenceScore,
			EntryPrice:      row.EntryPrice,
			CheckPrice:      nullFloat(row.CheckPrice),
			PriceChangePct:  nullFloat(row.PriceChangePct),
			Outcome:         row.Outcome,
			CheckedAt:       nullTime(row.CheckedAt),
			CreatedAt:       row.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	t.cacheSet(ctx, cacheKey, items)
	return items, nil
}

func (t *OutcomeTracker) RefreshStatsCaches(ctx context.Context) error {
	overview, err := t.Overview(ctx, "all")
	if err != nil {
		return err
	}
	pairs, err := t.ByPair(ctx)
	if err != nil {
		return err
	}
	timeframes, err := t.ByTimeframe(ctx)
	if err != nil {
		return err
	}
	confidence, err := t.ByConfidence(ctx)
	if err != nil {
		return err
	}
	t.cacheSet(ctx, "stats:overall", overview)
	if len(pairs) > 0 {
		t.cacheSet(ctx, "stats:pair:"+pairs[0].Pair, pairs[0])
	}
	for _, item := range pairs {
		t.cacheSet(ctx, "stats:pair:"+item.Pair, item)
		_ = t.upsertStatRow(ctx, "pair", "", item.Pair, "", "", item.TotalSignals, item.WinCount, item.LossCount, item.WinRate, item.AvgWinPct, 0, "", "")
	}
	for _, item := range timeframes {
		_ = t.upsertStatRow(ctx, "timeframe", "", "", item.Timeframe, "", item.TotalSignals, item.WinCount, item.LossCount, item.WinRate, 0, 0, "", "")
	}
	for _, item := range confidence {
		_ = t.upsertStatRow(ctx, "confidence", item.Bucket, "", "", "", item.TotalSignals, item.WinCount, item.LossCount, item.WinRate, 0, 0, "", "")
	}
	bestPair := ""
	worstPair := ""
	if len(pairs) > 0 {
		bestPair = pairs[0].Pair
		worstPair = pairs[len(pairs)-1].Pair
	}
	return t.upsertStatRow(ctx, "overall", "", "", "", "", overview.TotalSignals, overview.WinCount, overview.LossCount, overview.WinRate, overview.AvgWinPct, overview.AvgLossPct, bestPair, worstPair)
}

func (t *OutcomeTracker) upsertStatRow(ctx context.Context, scope, bucket, pair, timeframe, edge string, total, winCount, lossCount int, winRate, avgWinPct, avgLossPct float64, bestPair, worstPair string) error {
	_, err := t.db.ExecContext(ctx, `
		INSERT INTO signal_stats (id, scope, bucket, pair, timeframe, edge, total_signals, win_count, loss_count, win_rate, avg_win_pct, avg_loss_pct, best_pair, worst_pair, calculated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
		ON CONFLICT (scope, bucket, pair, timeframe, edge)
		DO UPDATE SET
			total_signals = EXCLUDED.total_signals,
			win_count = EXCLUDED.win_count,
			loss_count = EXCLUDED.loss_count,
			win_rate = EXCLUDED.win_rate,
			avg_win_pct = EXCLUDED.avg_win_pct,
			avg_loss_pct = EXCLUDED.avg_loss_pct,
			best_pair = EXCLUDED.best_pair,
			worst_pair = EXCLUDED.worst_pair,
			calculated_at = NOW()
	`, uuid.NewString(), scope, bucket, pair, timeframe, edge, total, winCount, lossCount, winRate, avgWinPct, avgLossPct, bestPair, worstPair)
	return err
}

func nullFloat(value sql.NullFloat64) float64 {
	if !value.Valid {
		return 0
	}
	return value.Float64
}

func nullTime(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}

func firstNonEmpty(values ...string) string {
	for _, item := range values {
		if strings.TrimSpace(item) != "" {
			return item
		}
	}
	return ""
}
