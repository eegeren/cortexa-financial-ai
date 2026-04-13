package bot

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Engine struct {
	service  *Service
	executor *BinanceExecutor
	logger   *zap.Logger
}

func NewEngine(service *Service, executor *BinanceExecutor, logger *zap.Logger) *Engine {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Engine{service: service, executor: executor, logger: logger}
}

func (e *Engine) Start(ctx context.Context) error {
	if e.service == nil || e.service.Redis() == nil {
		e.logger.Info("bot_engine_disabled", zap.String("reason", "redis_not_configured"))
		return nil
	}
	pubsub := e.service.Redis().Subscribe(ctx, "signals:new")
	defer pubsub.Close()

	ch := pubsub.Channel()
	e.logger.Info("bot_engine_started", zap.String("channel", "signals:new"))
	for {
		select {
		case <-ctx.Done():
			e.logger.Info("bot_engine_stopped")
			return ctx.Err()
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			var event SignalEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				e.logger.Warn("bot_engine_signal_decode_failed", zap.Error(err))
				continue
			}
			go e.processSignal(context.Background(), event)
		}
	}
}

func pairAllowed(settings BotSettings, pair string) bool {
	if settings.AllPairs {
		return true
	}
	normalized := normalizePairSymbol(pair)
	for _, item := range settings.PairsWhitelist {
		if normalizePairSymbol(item) == normalized {
			return true
		}
	}
	return false
}

func signalDirection(event SignalEvent) string {
	side := strings.ToLower(strings.TrimSpace(event.Side))
	edge := strings.ToLower(strings.TrimSpace(event.Edge))
	switch {
	case side == "buy" || edge == "long":
		return "long"
	case side == "sell" || edge == "short":
		return "short"
	case edge == "none" || edge == "limited" || side == "hold":
		return ""
	default:
		return ""
	}
}

func (e *Engine) processSignal(ctx context.Context, event SignalEvent) {
	settingsList, err := e.service.ActiveSettings(ctx)
	if err != nil {
		e.logger.Error("bot_engine_active_settings_failed", zap.Error(err))
		return
	}

	direction := signalDirection(event)
	if direction == "" {
		e.logger.Info("bot_engine_signal_skipped",
			zap.String("pair", event.Pair),
			zap.String("reason", "non_actionable_edge"),
		)
		return
	}

	var wg sync.WaitGroup
	for _, settings := range settingsList {
		settings := settings
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.processSignalForUser(ctx, settings, event, direction)
		}()
	}
	wg.Wait()
}

func (e *Engine) processSignalForUser(ctx context.Context, settings BotSettings, event SignalEvent, direction string) {
	logFields := []zap.Field{
		zap.Int64("user_id", settings.UserID),
		zap.String("pair", normalizePairSymbol(event.Pair)),
		zap.String("timeframe", event.Timeframe),
		zap.String("direction", direction),
	}

	if !settings.Active {
		e.logger.Info("bot_engine_skip_inactive", logFields...)
		return
	}
	if !settings.HasBinanceAPIKey {
		e.logger.Info("bot_engine_skip_missing_credentials", logFields...)
		return
	}
	if !pairAllowed(settings, event.Pair) {
		e.logger.Info("bot_engine_skip_pair_filter", logFields...)
		return
	}
	if event.Confidence < settings.MinConfidence {
		e.logger.Info("bot_engine_skip_confidence", append(logFields, zap.Int("confidence", event.Confidence), zap.Int("min_confidence", settings.MinConfidence))...)
		return
	}
	if settings.TradeType == "spot" && direction == "short" {
		e.logger.Info("bot_engine_skip_spot_short", logFields...)
		return
	}
	if event.EntryPrice <= 0 {
		e.logger.Info("bot_engine_skip_missing_price", logFields...)
		return
	}

	apiKey, apiSecret, err := e.service.Credentials(ctx, settings.UserID)
	if err != nil {
		e.logger.Warn("bot_engine_credentials_failed", append(logFields, zap.Error(err))...)
		return
	}

	balance, err := e.executor.BalanceForTradeType(ctx, apiKey, apiSecret, settings.TradeType)
	if err != nil {
		e.handleExecutionError(ctx, settings, event, err, "failed", 0)
		return
	}
	if balance <= 0 {
		e.logger.Info("bot_engine_skip_zero_balance", append(logFields, zap.Float64("balance", balance))...)
		return
	}

	exceeded, lossPct, err := e.service.DailyLossLimitExceeded(ctx, settings.UserID, balance, settings.DailyLossLimitPct)
	if err != nil {
		e.logger.Warn("bot_engine_daily_loss_check_failed", append(logFields, zap.Error(err))...)
	}
	if exceeded {
		_ = e.service.DisableBot(ctx, settings.UserID)
		e.logger.Warn("bot_engine_daily_loss_limit_reached", append(logFields, zap.Float64("loss_pct", lossPct), zap.Float64("limit_pct", settings.DailyLossLimitPct))...)
		return
	}

	notional := balance * settings.MaxPositionPct / 100
	quantity := notional / event.EntryPrice
	if quantity <= 0 {
		e.logger.Info("bot_engine_skip_invalid_quantity", append(logFields, zap.Float64("balance", balance), zap.Float64("entry_price", event.EntryPrice))...)
		return
	}

	atr := event.ATR
	if atr <= 0 {
		atr = event.EntryPrice * 0.01
	}
	sl := event.EntryPrice - (atr * 1.5)
	tp := event.EntryPrice + (atr * 2.5)
	if direction == "short" {
		sl = event.EntryPrice + (atr * 1.5)
		tp = event.EntryPrice - (atr * 2.5)
	}

	request := OrderRequest{
		Pair:       normalizePairSymbol(event.Pair),
		Side:       direction,
		Quantity:   quantity,
		EntryPrice: event.EntryPrice,
		SLPrice:    sl,
		TPPrice:    tp,
		UserID:     settings.UserID,
		SignalID:   firstNonEmpty(event.SignalID, buildSignalID(event)),
		TradeType:  settings.TradeType,
		Timeframe:  event.Timeframe,
	}

	response, err := e.executor.PlaceOrder(ctx, apiKey, apiSecret, request)
	if err != nil {
		e.handleExecutionError(ctx, settings, event, err, response.Error, request.EntryPrice)
		return
	}

	orderID := response.OrderID
	if strings.TrimSpace(orderID) == "" {
		orderID = uuid.NewString()
	}
	if err := e.service.SaveOrder(ctx, BotOrder{
		ID:              orderID,
		UserID:          settings.UserID,
		SignalID:        request.SignalID,
		Pair:            request.Pair,
		Timeframe:       request.Timeframe,
		Side:            request.Side,
		Quantity:        request.Quantity,
		EntryPrice:      request.EntryPrice,
		SLPrice:         request.SLPrice,
		TPPrice:         request.TPPrice,
		Status:          normalizeOrderStatus(response.Status),
		ErrorMessage:    response.Error,
		ExchangeOrderID: response.ExchangeID,
		FilledPrice:     response.FilledPrice,
		CreatedAt:       time.Now(),
	}); err != nil {
		e.logger.Error("bot_engine_save_order_failed", append(logFields, zap.Error(err))...)
		return
	}

	e.logger.Info("bot_engine_order_created",
		append(logFields,
			zap.Float64("quantity", request.Quantity),
			zap.Float64("entry_price", request.EntryPrice),
			zap.Float64("sl", request.SLPrice),
			zap.Float64("tp", request.TPPrice),
			zap.String("status", normalizeOrderStatus(response.Status)),
		)...,
	)
}

func normalizeOrderStatus(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "new", "partially_filled", "pending":
		return "pending"
	case "filled":
		return "filled"
	case "cancelled", "canceled":
		return "cancelled"
	default:
		if normalized == "" {
			return "failed"
		}
		return normalized
	}
}

func buildSignalID(event SignalEvent) string {
	return fmt.Sprintf("%s:%s:%d", normalizePairSymbol(event.Pair), firstNonEmpty(event.Timeframe, "1h"), time.Now().Unix())
}

func (e *Engine) handleExecutionError(ctx context.Context, settings BotSettings, event SignalEvent, err error, fallbackMessage string, entryPrice float64) {
	message := strings.TrimSpace(fallbackMessage)
	if message == "" && err != nil {
		message = err.Error()
	}
	status := "failed"
	orderID := uuid.NewString()
	_ = e.service.SaveOrder(ctx, BotOrder{
		ID:           orderID,
		UserID:       settings.UserID,
		SignalID:     firstNonEmpty(event.SignalID, buildSignalID(event)),
		Pair:         normalizePairSymbol(event.Pair),
		Timeframe:    event.Timeframe,
		Side:         signalDirection(event),
		Quantity:     0,
		EntryPrice:   event.EntryPrice,
		SLPrice:      0,
		TPPrice:      0,
		Status:       status,
		ErrorMessage: message,
		CreatedAt:    time.Now(),
	})

	var apiErr *BinanceAPIError
	if err != nil && AsBinanceAPIError(err, &apiErr) {
		switch apiErr.Code {
		case -1121:
			_ = e.service.DisablePair(ctx, settings.UserID, event.Pair)
			e.logger.Warn("bot_engine_pair_disabled", zap.Int64("user_id", settings.UserID), zap.String("pair", event.Pair), zap.Int("code", apiErr.Code), zap.String("error", apiErr.Msg))
		case -2015:
			_ = e.service.DisableBot(ctx, settings.UserID)
			e.logger.Warn("bot_engine_bot_disabled_invalid_key", zap.Int64("user_id", settings.UserID), zap.Int("code", apiErr.Code), zap.String("error", apiErr.Msg))
		case -2010:
			e.logger.Warn("bot_engine_insufficient_balance", zap.Int64("user_id", settings.UserID), zap.String("pair", event.Pair), zap.Int("code", apiErr.Code), zap.String("error", apiErr.Msg))
		default:
			e.logger.Warn("bot_engine_execution_failed", zap.Int64("user_id", settings.UserID), zap.String("pair", event.Pair), zap.Int("code", apiErr.Code), zap.String("error", apiErr.Msg))
		}
		return
	}
	if err != nil {
		e.logger.Warn("bot_engine_execution_failed", zap.Int64("user_id", settings.UserID), zap.String("pair", event.Pair), zap.Error(err))
	}
}

func AsBinanceAPIError(err error, target **BinanceAPIError) bool {
	apiErr, ok := err.(*BinanceAPIError)
	if !ok {
		return false
	}
	*target = apiErr
	return true
}
