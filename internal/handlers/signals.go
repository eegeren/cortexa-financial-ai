package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

func (h *Handlers) GetSignals(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	res, err := h.Signal.Predict(r.Context(), symbol)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, res)
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

	resp, err := h.Signal.Backtest(r.Context(), symbol, th, limit, horizon, commissionBps, slippageBps, positionSize)
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
	horizons := parseIntList(r.URL.Query().Get("horizons"), []int{2, 4, 6})
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

	resp, err := h.Signal.BacktestSweep(r.Context(), symbol, thresholds, horizons, limit, commissionBps, slippageBps, positionSize)
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
		sig, err := h.Signal.Predict(ctx, symbol)
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
	sig, err := h.Signal.Predict(r.Context(), symbol)
	if err != nil {
		http.Error(w, "signal error: "+err.Error(), http.StatusBadGateway)
		return
	}

	if (sig.Side == "BUY" || sig.Side == "SELL") && sig.Score >= threshold {
		uid := h.UserIDFromCtx(r.Context())
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
