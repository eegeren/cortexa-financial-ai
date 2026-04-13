package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	botpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/bot"
	"github.com/go-chi/chi/v5"
)

type botSettingsPayload struct {
	Active             bool     `json:"active"`
	PairsWhitelist     []string `json:"pairs_whitelist"`
	AllPairs           bool     `json:"all_pairs"`
	MinConfidence      int      `json:"min_confidence"`
	MaxPositionPct     float64  `json:"max_position_pct"`
	DailyLossLimitPct  float64  `json:"daily_loss_limit_pct"`
	TradeType          string   `json:"trade_type"`
	BinanceAPIKey      string   `json:"api_key"`
	BinanceAPISecret   string   `json:"api_secret"`
}

type botTogglePayload struct {
	Active bool `json:"active"`
}

type botConnectionPayload struct {
	APIKey    string `json:"api_key"`
	APISecret string `json:"api_secret"`
}

func (h *Handlers) requirePremiumBotAccess(w http.ResponseWriter, r *http.Request) (int64, bool) {
	uid := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	ok, err := h.Billing.HasPremiumAccess(r.Context(), uid, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return 0, false
	}
	if !ok {
		http.Error(w, "premium access required", http.StatusForbidden)
		return 0, false
	}
	if h.Bot == nil {
		http.Error(w, "bot service unavailable", http.StatusServiceUnavailable)
		return 0, false
	}
	return uid, true
}

func (h *Handlers) GetBotSettings(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	settings, err := h.Bot.GetSettings(r.Context(), uid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handlers) UpdateBotSettings(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	defer r.Body.Close()
	var payload botSettingsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	settings, err := h.Bot.UpdateSettings(r.Context(), uid, botpkg.BotSettings{
		UserID:            uid,
		Active:            payload.Active,
		PairsWhitelist:    payload.PairsWhitelist,
		AllPairs:          payload.AllPairs,
		MinConfidence:     payload.MinConfidence,
		MaxPositionPct:    payload.MaxPositionPct,
		DailyLossLimitPct: payload.DailyLossLimitPct,
		TradeType:         payload.TradeType,
	}, payload.BinanceAPIKey, payload.BinanceAPISecret)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handlers) TestBotConnection(w http.ResponseWriter, r *http.Request) {
	_, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	defer r.Body.Close()
	var payload botConnectionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if h.BotExec == nil {
		http.Error(w, "binance executor unavailable", http.StatusServiceUnavailable)
		return
	}
	result, err := h.BotExec.TestConnection(r.Context(), strings.TrimSpace(payload.APIKey), strings.TrimSpace(payload.APISecret))
	if err != nil && !result.Success {
		writeJSON(w, http.StatusBadRequest, result)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handlers) ToggleBot(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	defer r.Body.Close()
	var payload botTogglePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	settings, err := h.Bot.Toggle(r.Context(), uid, payload.Active)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"active": settings.Active})
}

func (h *Handlers) GetBotOrders(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	pair := strings.TrimSpace(r.URL.Query().Get("pair"))
	items, err := h.Bot.ListOrders(r.Context(), uid, page, limit, status, pair)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handlers) CancelBotOrder(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.requirePremiumBotAccess(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	order, err := h.Bot.GetOrder(r.Context(), uid, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "order not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if strings.EqualFold(order.Status, "filled") {
		http.Error(w, "filled orders cannot be cancelled", http.StatusBadRequest)
		return
	}
	if !strings.EqualFold(order.Status, "pending") {
		http.Error(w, "only pending orders can be cancelled", http.StatusBadRequest)
		return
	}
	if h.BotExec != nil && order.ExchangeOrderID != "" {
		settings, err := h.Bot.GetSettings(r.Context(), uid)
		if err == nil && settings.HasBinanceAPIKey {
			apiKey, apiSecret, credErr := h.Bot.Credentials(r.Context(), uid)
			if credErr == nil {
				_ = h.BotExec.CancelOrder(r.Context(), apiKey, apiSecret, order.Pair, order.ExchangeOrderID, settings.TradeType)
			}
		}
	}
	if err := h.Bot.UpdateOrderStatus(r.Context(), uid, id, "cancelled", "cancelled by user", nil); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
