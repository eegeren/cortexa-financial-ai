package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

func (h *Handlers) StatsOverview(w http.ResponseWriter, r *http.Request) {
	if h.Validator == nil {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	period := strings.TrimSpace(r.URL.Query().Get("period"))
	if period == "" {
		period = "30d"
	}
	payload, err := h.Validator.Overview(r.Context(), period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) StatsByPair(w http.ResponseWriter, r *http.Request) {
	if h.Validator == nil {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	payload, err := h.Validator.ByPair(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": payload})
}

func (h *Handlers) StatsByTimeframe(w http.ResponseWriter, r *http.Request) {
	if h.Validator == nil {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	payload, err := h.Validator.ByTimeframe(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": payload})
}

func (h *Handlers) StatsByConfidence(w http.ResponseWriter, r *http.Request) {
	if h.Validator == nil {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	payload, err := h.Validator.ByConfidence(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": payload})
}

func (h *Handlers) RecentOutcomes(w http.ResponseWriter, r *http.Request) {
	if h.Validator == nil {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	payload, err := h.Validator.RecentOutcomes(r.Context(), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": payload})
}
