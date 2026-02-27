package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func (h *Handlers) GetPrices(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "1h"
	}
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 && v <= 1000 {
			limit = v
		}
	}

	data, err := h.Price.GetOHLCV(r.Context(), symbol, interval, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, data)
}
