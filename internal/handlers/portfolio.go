package handlers

import (
	"encoding/json"
	"net/http"
)

type tradeReq struct {
	Symbol string  `json:"symbol"`
	Side   string  `json:"side"` // BUY/SELL
	Qty    float64 `json:"qty"`
	Price  float64 `json:"price"`
}

func (h *Handlers) GetPortfolio(w http.ResponseWriter, r *http.Request) {
	uid := h.UserIDFromCtx(r.Context())
	p, err := h.Portfolio.GetPortfolio(r.Context(), uid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handlers) CreateTrade(w http.ResponseWriter, r *http.Request) {
	uid := h.UserIDFromCtx(r.Context())
	var req tradeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.Portfolio.CreateTrade(r.Context(), uid, req.Symbol, req.Side, req.Qty, req.Price); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Binance anahtarı varsa, siparişi otomatik gönder (fire-and-forget)
	if h.Cfg.BinanceAPIKey != "" && h.Cfg.BinanceSecret != "" {
		go func(sym, side string, qty float64) {
			_ = h.Webhook.SendBinanceMarketOrder(r.Context(), sym, side, qty)
		}(req.Symbol, req.Side, req.Qty)
	}

	writeJSON(w, http.StatusCreated, map[string]string{"message": "ok"})
}
