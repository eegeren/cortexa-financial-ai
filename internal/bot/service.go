package bot

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	redis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
)

type Service struct {
	db     *sqlx.DB
	cfg    config.Config
	redis  *redis.Client
	logger *zap.Logger
}

func NewService(db *sqlx.DB, cfg config.Config, logger *zap.Logger) *Service {
	if logger == nil {
		logger = zap.NewNop()
	}
	service := &Service{db: db, cfg: cfg, logger: logger}
	if strings.TrimSpace(cfg.RedisURL) != "" {
		if opts, err := redis.ParseURL(strings.TrimSpace(cfg.RedisURL)); err == nil {
			service.redis = redis.NewClient(opts)
		} else {
			service.redis = redis.NewClient(&redis.Options{Addr: strings.TrimSpace(cfg.RedisURL)})
		}
	}
	return service
}

func (s *Service) Logger() *zap.Logger {
	if s.logger == nil {
		return zap.NewNop()
	}
	return s.logger
}

func (s *Service) Redis() *redis.Client {
	return s.redis
}

func DefaultSettings(userID int64) BotSettings {
	return BotSettings{
		UserID:            userID,
		Active:            false,
		PairsWhitelist:    []string{"BTCUSDT", "ETHUSDT", "SOLUSDT"},
		AllPairs:          false,
		MinConfidence:     65,
		MaxPositionPct:    5,
		DailyLossLimitPct: 3,
		TradeType:         "spot",
	}
}

func maskAPIKey(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 8 {
		if trimmed == "" {
			return ""
		}
		return "****"
	}
	return trimmed[:4] + "****" + trimmed[len(trimmed)-4:]
}

func normalizePairs(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, item := range values {
		normalized := strings.ToUpper(strings.TrimSpace(strings.ReplaceAll(item, "/", "")))
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func (s *Service) GetSettings(ctx context.Context, userID int64) (BotSettings, error) {
	settings := DefaultSettings(userID)
	var row struct {
		UserID              int64          `db:"user_id"`
		Active              bool           `db:"active"`
		PairsWhitelist      pq.StringArray `db:"pairs_whitelist"`
		AllPairs            bool           `db:"all_pairs"`
		MinConfidence       int            `db:"min_confidence"`
		MaxPositionPct      float64        `db:"max_position_pct"`
		DailyLossLimitPct   float64        `db:"daily_loss_limit_pct"`
		TradeType           string         `db:"trade_type"`
		BinanceAPIKeyEnc    string         `db:"binance_api_key_enc"`
		BinanceAPISecretEnc string         `db:"binance_api_secret_enc"`
		UpdatedAt           time.Time      `db:"updated_at"`
	}

	err := s.db.GetContext(ctx, &row, `
		SELECT user_id, active, pairs_whitelist, COALESCE(all_pairs, FALSE) AS all_pairs,
		       min_confidence, max_position_pct, daily_loss_limit_pct, trade_type,
		       COALESCE(binance_api_key_enc, '') AS binance_api_key_enc,
		       COALESCE(binance_api_secret_enc, '') AS binance_api_secret_enc,
		       updated_at
		FROM bot_settings
		WHERE user_id = $1
	`, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return settings, nil
		}
		return settings, err
	}

	settings.Active = row.Active
	settings.PairsWhitelist = normalizePairs([]string(row.PairsWhitelist))
	settings.AllPairs = row.AllPairs
	settings.MinConfidence = row.MinConfidence
	settings.MaxPositionPct = row.MaxPositionPct
	settings.DailyLossLimitPct = row.DailyLossLimitPct
	settings.TradeType = strings.ToLower(strings.TrimSpace(row.TradeType))
	settings.BinanceAPIKeyEnc = row.BinanceAPIKeyEnc
	settings.BinanceAPISecretEnc = row.BinanceAPISecretEnc
	settings.UpdatedAt = row.UpdatedAt
	settings.HasBinanceAPIKey = row.BinanceAPIKeyEnc != "" && row.BinanceAPISecretEnc != ""
	if settings.HasBinanceAPIKey {
		if plain, err := decryptSecret(s.cfg.EncryptionKey, row.BinanceAPIKeyEnc); err == nil {
			settings.MaskedBinanceAPIKey = maskAPIKey(plain)
		}
	}
	return settings, nil
}

func (s *Service) UpdateSettings(ctx context.Context, userID int64, input BotSettings, apiKey, apiSecret string) (BotSettings, error) {
	current, err := s.GetSettings(ctx, userID)
	if err != nil {
		return current, err
	}

	tradeType := strings.ToLower(strings.TrimSpace(input.TradeType))
	if tradeType == "" {
		tradeType = current.TradeType
	}
	if tradeType != "spot" && tradeType != "futures" {
		tradeType = "spot"
	}

	pairs := normalizePairs(input.PairsWhitelist)
	if len(pairs) == 0 && !input.AllPairs {
		pairs = current.PairsWhitelist
		if len(pairs) == 0 {
			pairs = DefaultSettings(userID).PairsWhitelist
		}
	}

	minConfidence := input.MinConfidence
	if minConfidence == 0 {
		minConfidence = current.MinConfidence
	}
	if minConfidence < 50 {
		minConfidence = 50
	}
	if minConfidence > 90 {
		minConfidence = 90
	}

	maxPositionPct := input.MaxPositionPct
	if maxPositionPct == 0 {
		maxPositionPct = current.MaxPositionPct
	}
	if maxPositionPct < 1 {
		maxPositionPct = 1
	}
	if maxPositionPct > 20 {
		maxPositionPct = 20
	}

	dailyLossLimitPct := input.DailyLossLimitPct
	if dailyLossLimitPct == 0 {
		dailyLossLimitPct = current.DailyLossLimitPct
	}
	if dailyLossLimitPct < 0.5 {
		dailyLossLimitPct = 0.5
	}

	apiKeyEnc := current.BinanceAPIKeyEnc
	apiSecretEnc := current.BinanceAPISecretEnc
	if strings.TrimSpace(apiKey) != "" {
		ciphertext, err := encryptSecret(s.cfg.EncryptionKey, strings.TrimSpace(apiKey))
		if err != nil {
			return current, err
		}
		apiKeyEnc = ciphertext
	}
	if strings.TrimSpace(apiSecret) != "" {
		ciphertext, err := encryptSecret(s.cfg.EncryptionKey, strings.TrimSpace(apiSecret))
		if err != nil {
			return current, err
		}
		apiSecretEnc = ciphertext
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO bot_settings (
			user_id, active, pairs_whitelist, all_pairs, min_confidence, max_position_pct,
			daily_loss_limit_pct, trade_type, binance_api_key_enc, binance_api_secret_enc, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			active = EXCLUDED.active,
			pairs_whitelist = EXCLUDED.pairs_whitelist,
			all_pairs = EXCLUDED.all_pairs,
			min_confidence = EXCLUDED.min_confidence,
			max_position_pct = EXCLUDED.max_position_pct,
			daily_loss_limit_pct = EXCLUDED.daily_loss_limit_pct,
			trade_type = EXCLUDED.trade_type,
			binance_api_key_enc = EXCLUDED.binance_api_key_enc,
			binance_api_secret_enc = EXCLUDED.binance_api_secret_enc,
			updated_at = NOW()
	`, userID, input.Active, pq.Array(pairs), input.AllPairs, minConfidence, maxPositionPct, dailyLossLimitPct, tradeType, apiKeyEnc, apiSecretEnc)
	if err != nil {
		return current, err
	}
	_ = s.InvalidateCache(ctx, userID)
	return s.GetSettings(ctx, userID)
}

func (s *Service) Toggle(ctx context.Context, userID int64, active bool) (BotSettings, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return settings, err
	}
	if active && (!settings.HasBinanceAPIKey) {
		return settings, fmt.Errorf("binance api key required")
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO bot_settings (user_id, active, pairs_whitelist, all_pairs, min_confidence, max_position_pct, daily_loss_limit_pct, trade_type, binance_api_key_enc, binance_api_secret_enc, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
		ON CONFLICT (user_id) DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
	`, userID, active, pq.Array(settings.PairsWhitelist), settings.AllPairs, settings.MinConfidence, settings.MaxPositionPct, settings.DailyLossLimitPct, settings.TradeType, settings.BinanceAPIKeyEnc, settings.BinanceAPISecretEnc)
	if err != nil {
		return settings, err
	}
	_ = s.InvalidateCache(ctx, userID)
	return s.GetSettings(ctx, userID)
}

func (s *Service) InvalidateCache(ctx context.Context, userID int64) error {
	if s.redis == nil {
		return nil
	}
	return s.redis.Del(ctx, fmt.Sprintf("bot:settings:%d", userID)).Err()
}

func (s *Service) PublishSignal(ctx context.Context, event SignalEvent) error {
	if s.redis == nil {
		return nil
	}
	payload, err := jsonMarshal(event)
	if err != nil {
		return err
	}
	return s.redis.Publish(ctx, "signals:new", payload).Err()
}

func (s *Service) SaveOrder(ctx context.Context, order BotOrder) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO bot_orders (
			id, user_id, signal_id, pair, timeframe, side, quantity, entry_price, sl_price, tp_price,
			status, error_message, exchange_order_id, filled_price, created_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15, NOW()))
	`, order.ID, order.UserID, order.SignalID, order.Pair, order.Timeframe, order.Side, order.Quantity, order.EntryPrice, order.SLPrice, order.TPPrice, order.Status, order.ErrorMessage, order.ExchangeOrderID, order.FilledPrice, nullableTime(order.CreatedAt))
	return err
}

func (s *Service) UpdateOrderStatus(ctx context.Context, userID int64, id, status, errorMessage string, filledPrice *float64) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE bot_orders
		SET status = $3,
		    error_message = $4,
		    filled_price = COALESCE($5, filled_price)
		WHERE id = $1 AND user_id = $2
	`, id, userID, status, errorMessage, filledPrice)
	return err
}

func (s *Service) GetOrder(ctx context.Context, userID int64, id string) (BotOrder, error) {
	var order BotOrder
	err := s.db.GetContext(ctx, &order, `
		SELECT id, user_id, COALESCE(signal_id, '') AS signal_id, pair, COALESCE(timeframe, '') AS timeframe, side,
		       quantity, entry_price, sl_price, tp_price, status,
		       COALESCE(error_message, '') AS error_message,
		       COALESCE(exchange_order_id, '') AS exchange_order_id,
		       created_at, filled_price
		FROM bot_orders
		WHERE id = $1 AND user_id = $2
	`, id, userID)
	return order, err
}

func (s *Service) ListOrders(ctx context.Context, userID int64, page, limit int, status, pair string) (BotOrdersPage, error) {
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	filters := []string{"user_id = $1"}
	args := []any{userID}
	argPos := 2
	if normalized := strings.ToLower(strings.TrimSpace(status)); normalized != "" {
		filters = append(filters, fmt.Sprintf("status = $%d", argPos))
		args = append(args, normalized)
		argPos++
	}
	if normalized := strings.ToUpper(strings.TrimSpace(strings.ReplaceAll(pair, "/", ""))); normalized != "" {
		filters = append(filters, fmt.Sprintf("pair ILIKE $%d", argPos))
		args = append(args, "%"+normalized+"%")
		argPos++
	}
	whereClause := strings.Join(filters, " AND ")

	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM bot_orders WHERE %s`, whereClause)
	if err := s.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return BotOrdersPage{}, err
	}

	offset := (page - 1) * limit
	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT id, user_id, COALESCE(signal_id, '') AS signal_id, pair, COALESCE(timeframe, '') AS timeframe, side,
		       quantity, entry_price, sl_price, tp_price, status,
		       COALESCE(error_message, '') AS error_message,
		       COALESCE(exchange_order_id, '') AS exchange_order_id,
		       created_at, filled_price
		FROM bot_orders
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)
	items := []BotOrder{}
	if err := s.db.SelectContext(ctx, &items, query, args...); err != nil {
		return BotOrdersPage{}, err
	}
	return BotOrdersPage{Items: items, Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) DisablePair(ctx context.Context, userID int64, pair string) error {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return err
	}
	if settings.AllPairs {
		return nil
	}
	next := make([]string, 0, len(settings.PairsWhitelist))
	normalized := strings.ToUpper(strings.TrimSpace(strings.ReplaceAll(pair, "/", "")))
	for _, item := range settings.PairsWhitelist {
		if item != normalized {
			next = append(next, item)
		}
	}
	settings.PairsWhitelist = next
	_, err = s.db.ExecContext(ctx, `UPDATE bot_settings SET pairs_whitelist = $2, updated_at = NOW() WHERE user_id = $1`, userID, pq.Array(next))
	if err == nil {
		_ = s.InvalidateCache(ctx, userID)
	}
	return err
}

func (s *Service) DisableBot(ctx context.Context, userID int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE bot_settings SET active = FALSE, updated_at = NOW() WHERE user_id = $1`, userID)
	if err == nil {
		_ = s.InvalidateCache(ctx, userID)
	}
	return err
}

func (s *Service) ActiveSettings(ctx context.Context) ([]BotSettings, error) {
	rows := []struct {
		UserID              int64          `db:"user_id"`
		Active              bool           `db:"active"`
		PairsWhitelist      pq.StringArray `db:"pairs_whitelist"`
		AllPairs            bool           `db:"all_pairs"`
		MinConfidence       int            `db:"min_confidence"`
		MaxPositionPct      float64        `db:"max_position_pct"`
		DailyLossLimitPct   float64        `db:"daily_loss_limit_pct"`
		TradeType           string         `db:"trade_type"`
		BinanceAPIKeyEnc    string         `db:"binance_api_key_enc"`
		BinanceAPISecretEnc string         `db:"binance_api_secret_enc"`
		UpdatedAt           time.Time      `db:"updated_at"`
	}{}
	if err := s.db.SelectContext(ctx, &rows, `
		SELECT user_id, active, pairs_whitelist, COALESCE(all_pairs, FALSE) AS all_pairs, min_confidence,
		       max_position_pct, daily_loss_limit_pct, trade_type,
		       COALESCE(binance_api_key_enc, '') AS binance_api_key_enc,
		       COALESCE(binance_api_secret_enc, '') AS binance_api_secret_enc,
		       updated_at
		FROM bot_settings
		WHERE active = TRUE
	`); err != nil {
		return nil, err
	}
	items := make([]BotSettings, 0, len(rows))
	for _, row := range rows {
		items = append(items, BotSettings{
			UserID:              row.UserID,
			Active:              row.Active,
			PairsWhitelist:      normalizePairs([]string(row.PairsWhitelist)),
			AllPairs:            row.AllPairs,
			MinConfidence:       row.MinConfidence,
			MaxPositionPct:      row.MaxPositionPct,
			DailyLossLimitPct:   row.DailyLossLimitPct,
			TradeType:           strings.ToLower(strings.TrimSpace(row.TradeType)),
			BinanceAPIKeyEnc:    row.BinanceAPIKeyEnc,
			BinanceAPISecretEnc: row.BinanceAPISecretEnc,
			UpdatedAt:           row.UpdatedAt,
			HasBinanceAPIKey:    row.BinanceAPIKeyEnc != "" && row.BinanceAPISecretEnc != "",
		})
	}
	return items, nil
}

func (s *Service) DailyLossLimitExceeded(ctx context.Context, userID int64, currentBalance, limitPct float64) (bool, float64, error) {
	if limitPct <= 0 || currentBalance <= 0 {
		return false, 0, nil
	}
	var netFlow float64
	err := s.db.GetContext(ctx, &netFlow, `
		SELECT COALESCE(SUM(CASE WHEN side = 'SELL' THEN qty * price ELSE -1 * qty * price END), 0)
		FROM trades
		WHERE user_id = $1
		  AND created_at >= date_trunc('day', NOW())
	`, userID)
	if err != nil {
		return false, 0, err
	}
	lossPct := 0.0
	if netFlow < 0 {
		lossPct = math.Abs(netFlow) / currentBalance * 100
	}
	return lossPct >= limitPct, lossPct, nil
}

func (s *Service) Credentials(ctx context.Context, userID int64) (string, string, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return "", "", err
	}
	if settings.BinanceAPIKeyEnc == "" || settings.BinanceAPISecretEnc == "" {
		return "", "", fmt.Errorf("binance api credentials not configured")
	}
	apiKey, err := decryptSecret(s.cfg.EncryptionKey, settings.BinanceAPIKeyEnc)
	if err != nil {
		return "", "", err
	}
	apiSecret, err := decryptSecret(s.cfg.EncryptionKey, settings.BinanceAPISecretEnc)
	if err != nil {
		return "", "", err
	}
	return apiKey, apiSecret, nil
}

func jsonMarshal(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func nullableTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}
