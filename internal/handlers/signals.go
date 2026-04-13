package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	botpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/bot"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
	"github.com/go-chi/chi/v5"
)

func (h *Handlers) GetSignals(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	timeframe := strings.TrimSpace(r.URL.Query().Get("timeframe"))
	if timeframe == "" {
		timeframe = "1h"
	}
	uid := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), uid, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	usage, err := h.Usage.CheckAndIncrementSignalUsage(r.Context(), uid, isPremium)
	if err != nil {
		if errors.Is(err, services.ErrDailyLimitReached) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"code":    "daily_limit_reached",
				"message": "Daily limit reached",
				"usage": map[string]any{
					"used":       usage.Used,
					"limit":      usage.Limit,
					"remaining":  usage.Remaining,
					"is_premium": usage.IsPremium,
					"reset_at":   usage.ResetAt.Format(time.RFC3339),
				},
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	res, err := h.Signal.Predict(r.Context(), symbol, timeframe)
	if err != nil {
		log.Printf("GetSignals failed for %s: %v", symbol, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	res.Usage = &models.SignalUsage{
		Used:      usage.Used,
		Limit:     usage.Limit,
		Remaining: usage.Remaining,
		IsPremium: usage.IsPremium,
		ResetAt:   usage.ResetAt.Format(time.RFC3339),
	}
	if h.Validator != nil {
		if signalID, err := h.Validator.RecordSignal(r.Context(), res.Symbol, timeframe, signalEdgeForStorage(*res), res.Confidence, signalPriceForStorage(*res), time.Now().UTC()); err == nil {
			res.ID = signalID
		}
	}
	if h.Bot != nil {
		_ = h.Bot.PublishSignal(r.Context(), signalEventFromModel(*res))
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handlers) GetSignalsBatch(w http.ResponseWriter, r *http.Request) {
	rawSymbols := strings.TrimSpace(r.URL.Query().Get("symbols"))
	if rawSymbols == "" {
		http.Error(w, "symbols query is required", http.StatusBadRequest)
		return
	}

	timeframe := strings.TrimSpace(r.URL.Query().Get("timeframe"))
	if timeframe == "" {
		timeframe = "1h"
	}

	parsed := make([]string, 0)
	seen := make(map[string]struct{})
	for _, symbol := range strings.Split(rawSymbols, ",") {
		normalized := strings.ToUpper(strings.TrimSpace(symbol))
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		parsed = append(parsed, normalized)
	}
	if len(parsed) == 0 {
		http.Error(w, "symbols query is required", http.StatusBadRequest)
		return
	}

	uid := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), uid, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	usage, err := h.Usage.CheckAndIncrementSignalUsage(r.Context(), uid, isPremium)
	if err != nil {
		if errors.Is(err, services.ErrDailyLimitReached) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"code":    "daily_limit_reached",
				"message": "Daily limit reached",
				"usage": map[string]any{
					"used":       usage.Used,
					"limit":      usage.Limit,
					"remaining":  usage.Remaining,
					"is_premium": usage.IsPremium,
					"reset_at":   usage.ResetAt.Format(time.RFC3339),
				},
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	items, err := h.Signal.BatchPredict(r.Context(), parsed, timeframe)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	if h.Validator != nil {
		for index := range items {
			if signalID, err := h.Validator.RecordSignal(r.Context(), items[index].Symbol, timeframe, signalEdgeForStorage(items[index]), items[index].Confidence, signalPriceForStorage(items[index]), time.Now().UTC()); err == nil {
				items[index].ID = signalID
			}
		}
	}
	if h.Bot != nil {
		for _, item := range items {
			_ = h.Bot.PublishSignal(r.Context(), signalEventFromModel(item))
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": len(items),
		"usage": map[string]any{
			"used":       usage.Used,
			"limit":      usage.Limit,
			"remaining":  usage.Remaining,
			"is_premium": usage.IsPremium,
			"reset_at":   usage.ResetAt.Format(time.RFC3339),
		},
	})
}

func (h *Handlers) GetSignalUsage(w http.ResponseWriter, r *http.Request) {
	uid := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), uid, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	usage, err := h.Usage.CurrentSignalUsage(r.Context(), uid, isPremium)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"usage": map[string]any{
			"used":       usage.Used,
			"limit":      usage.Limit,
			"remaining":  usage.Remaining,
			"is_premium": usage.IsPremium,
			"reset_at":   usage.ResetAt.Format(time.RFC3339),
		},
	})
}

func (h *Handlers) GetMarketSymbols(w http.ResponseWriter, r *http.Request) {
	symbols, err := h.Signal.Symbols(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"symbols": symbols,
	})
}

func (h *Handlers) GetMarketSummary(w http.ResponseWriter, r *http.Request) {
	rawSymbols := strings.TrimSpace(r.URL.Query().Get("symbols"))
	var symbols []string
	if rawSymbols != "" {
		for _, symbol := range strings.Split(rawSymbols, ",") {
			if normalized := strings.ToUpper(strings.TrimSpace(symbol)); normalized != "" {
				symbols = append(symbols, normalized)
			}
		}
	}

	limit := 0
	if s := r.URL.Query().Get("limit"); s != "" {
		if value, err := strconv.Atoi(s); err == nil && value > 0 {
			limit = value
		}
	}

	items, err := h.Signal.MarketSummary(r.Context(), symbols, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": items,
	})
}

func (h *Handlers) GetNews(w http.ResponseWriter, r *http.Request) {
	currency := strings.TrimSpace(r.URL.Query().Get("currency"))
	if currency == "" {
		currency = "BTC"
	}
	limit := 20
	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			limit = v
		}
	}
	items, provider, err := h.Signal.News(r.Context(), currency, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"provider": provider,
		"items":    items,
	})
}

func (h *Handlers) GetInsight(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	var payload map[string]any
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		http.Error(w, "invalid insight payload", http.StatusBadRequest)
		return
	}

	insight, err := h.Signal.Insight(r.Context(), payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"insight": insight})
}

func (h *Handlers) GetSignalBacktest(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if h.RoleFromCtx(r.Context()) != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	th := 0.6
	if s := r.URL.Query().Get("threshold"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			th = v
		}
	}
	limit := 400
	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			limit = v
		}
	}
	horizon := 4
	if s := r.URL.Query().Get("horizon"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			horizon = v
		}
	}
	commissionBps := 4.0
	if s := r.URL.Query().Get("commission_bps"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			commissionBps = v
		}
	}
	slippageBps := 1.0
	if s := r.URL.Query().Get("slippage_bps"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			slippageBps = v
		}
	}
	positionSize := 1.0
	if s := r.URL.Query().Get("position_size"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			positionSize = v
		}
	}
	useAIValidation := true
	if s := r.URL.Query().Get("use_ai_validation"); s != "" {
		if v, err := strconv.ParseBool(s); err == nil {
			useAIValidation = v
		}
	}

	resp, err := h.Signal.Backtest(r.Context(), symbol, th, limit, horizon, commissionBps, slippageBps, positionSize, useAIValidation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handlers) GetSignalBacktestSweep(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if h.RoleFromCtx(r.Context()) != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	thresholds := parseFloatList(r.URL.Query().Get("thresholds"), []float64{0.4, 0.5, 0.6, 0.7})
	horizons := parseIntList(r.URL.Query().Get("horizons"), []int{1, 4, 12})
	limit := 400
	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			limit = v
		}
	}
	commissionBps := 4.0
	if s := r.URL.Query().Get("commission_bps"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			commissionBps = v
		}
	}
	slippageBps := 1.0
	if s := r.URL.Query().Get("slippage_bps"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			slippageBps = v
		}
	}
	positionSize := 1.0
	if s := r.URL.Query().Get("position_size"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			positionSize = v
		}
	}
	useAIValidation := true
	if s := r.URL.Query().Get("use_ai_validation"); s != "" {
		if v, err := strconv.ParseBool(s); err == nil {
			useAIValidation = v
		}
	}

	resp, err := h.Signal.BacktestSweep(r.Context(), symbol, thresholds, horizons, limit, commissionBps, slippageBps, positionSize, useAIValidation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func parseFloatList(raw string, def []float64) []float64 {
	if raw == "" {
		return def
	}
	parts := strings.Split(raw, ",")
	vals := make([]float64, 0, len(parts))
	for _, p := range parts {
		if v, err := strconv.ParseFloat(strings.TrimSpace(p), 64); err == nil {
			vals = append(vals, v)
		}
	}
	if len(vals) == 0 {
		return def
	}
	return vals
}

func parseIntList(raw string, def []int) []int {
	if raw == "" {
		return def
	}
	parts := strings.Split(raw, ",")
	vals := make([]int, 0, len(parts))
	for _, p := range parts {
		if v, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			vals = append(vals, v)
		}
	}
	if len(vals) == 0 {
		return def
	}
	return vals
}

func signalEventFromModel(signal models.Signal) botpkg.SignalEvent {
	entry := signalPriceForStorage(signal)
	atr := 0.0
	if signal.ATR != nil {
		atr = *signal.ATR
	}
	return botpkg.SignalEvent{
		SignalID:     firstNonEmpty(signal.ID, fmt.Sprintf("%s:%s:%d", signal.Symbol, firstNonEmpty(signal.Timeframe, "1h"), time.Now().Unix())),
		Symbol:       signal.Symbol,
		Pair:         signal.Symbol,
		Timeframe:    firstNonEmpty(signal.Timeframe, "1h"),
		Side:         signal.Side,
		Edge:         signalEdgeForStorage(signal),
		Confidence:   signal.Confidence,
		EntryPrice:   entry,
		ATR:          atr,
		CreatedAt:    time.Now().Format(time.RFC3339),
		QualityFlags: signal.QualityFlags,
	}
}

func signalEdgeForStorage(signal models.Signal) string {
	edge := strings.ToLower(strings.TrimSpace(signal.Edge))
	switch {
	case signal.Side == "BUY" || edge == "long" || strings.Contains(edge, "bull") || strings.Contains(edge, "directional"):
		return "long"
	case signal.Side == "SELL" || edge == "short" || strings.Contains(edge, "bear"):
		return "short"
	default:
		return "none"
	}
}

func signalPriceForStorage(signal models.Signal) float64 {
	if signal.Price != nil && *signal.Price > 0 {
		return *signal.Price
	}
	if signal.Levels.Support != nil && *signal.Levels.Support > 0 {
		return *signal.Levels.Support
	}
	if signal.Levels.Resistance != nil && *signal.Levels.Resistance > 0 {
		return *signal.Levels.Resistance
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, item := range values {
		if strings.TrimSpace(item) != "" {
			return item
		}
	}
	return ""
}

func (h *Handlers) StreamSignal(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(chi.URLParam(r, "symbol"))
	if symbol == "" {
		http.Error(w, "symbol required", http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	interval := 5 * time.Second
	if msStr := r.URL.Query().Get("interval"); msStr != "" {
		if ms, err := strconv.Atoi(msStr); err == nil && ms >= 1000 {
			interval = time.Duration(ms) * time.Millisecond
		}
	}

	ctx := r.Context()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	send := func() {
		timeframe := strings.TrimSpace(r.URL.Query().Get("timeframe"))
		if timeframe == "" {
			timeframe = "1h"
		}
		sig, err := h.Signal.Predict(ctx, symbol, timeframe)
		if err != nil {
			msg, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", msg)
			flusher.Flush()
			return
		}
		payload, _ := json.Marshal(sig)
		fmt.Fprintf(w, "data: %s\n\n", payload)
		flusher.Flush()
	}

	send()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			send()
		}
	}
}

// /api/signals/{symbol}/auto-trade?threshold=0.6&qty=0.001
func (h *Handlers) AutoTradeSignal(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	uid := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), uid, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !isPremium {
		http.Error(w, "premium required", http.StatusPaymentRequired)
		return
	}

	// Query params
	threshold := 0.6
	if s := r.URL.Query().Get("threshold"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil && v > 0 && v < 1 {
			threshold = v
		}
	}
	qty := 0.001
	if s := r.URL.Query().Get("qty"); s != "" {
		if v, err := strconv.ParseFloat(s, 64); err == nil && v > 0 {
			qty = v
		}
	}

	// Sinyal
	timeframe := strings.TrimSpace(r.URL.Query().Get("timeframe"))
	if timeframe == "" {
		timeframe = "1h"
	}
	sig, err := h.Signal.Predict(r.Context(), symbol, timeframe)
	if err != nil {
		http.Error(w, "signal error: "+err.Error(), http.StatusBadGateway)
		return
	}

	if (sig.Side == "BUY" || sig.Side == "SELL") && sig.Score >= threshold {
		if err := h.Portfolio.CreateTrade(r.Context(), uid, symbol, sig.Side, qty, 0); err != nil {
			http.Error(w, "trade error: "+err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"executed":  true,
			"symbol":    symbol,
			"side":      sig.Side,
			"score":     sig.Score,
			"qty":       qty,
			"threshold": threshold,
			"note":      "Executed via auto-trade rule (market order).",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"executed":  false,
		"symbol":    symbol,
		"side":      sig.Side,
		"score":     sig.Score,
		"threshold": threshold,
		"reason":    "Signal did not meet auto-trade criteria.",
	})
}
