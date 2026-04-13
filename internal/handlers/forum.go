package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func (h *Handlers) GetForumThreads(w http.ResponseWriter, r *http.Request) {
	topic := strings.TrimSpace(r.URL.Query().Get("topic"))
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	threads, err := h.Forum.ListThreads(r.Context(), topic, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"threads": threads,
	})
}

func (h *Handlers) CreateForumComment(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var payload struct {
		ThreadID string `json:"thread_id"`
		Body     string `json:"body"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		http.Error(w, "invalid comment payload", http.StatusBadRequest)
		return
	}
	body := strings.TrimSpace(payload.Body)
	if strings.TrimSpace(payload.ThreadID) == "" || body == "" {
		http.Error(w, "thread_id and body are required", http.StatusBadRequest)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), userID, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !isPremium {
		http.Error(w, "premium required", http.StatusPaymentRequired)
		return
	}
	user, err := h.Auth.GetUserByID(r.Context(), userID)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	displayName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if displayName == "" {
		displayName = strings.TrimSpace(user.Email)
	}
	comment, err := h.Forum.CreateComment(r.Context(), userID, payload.ThreadID, body, displayName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"comment": comment,
	})
}

func (h *Handlers) CreateForumVote(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var payload struct {
		ThreadID string `json:"thread_id"`
		Vote     string `json:"vote"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		http.Error(w, "invalid vote payload", http.StatusBadRequest)
		return
	}
	vote := strings.ToLower(strings.TrimSpace(payload.Vote))
	if strings.TrimSpace(payload.ThreadID) == "" || (vote != "bullish" && vote != "bearish" && vote != "chop") {
		http.Error(w, "thread_id and valid vote are required", http.StatusBadRequest)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	role := h.RoleFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	isPremium, err := h.Billing.HasPremiumAccess(r.Context(), userID, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !isPremium {
		http.Error(w, "premium required", http.StatusPaymentRequired)
		return
	}
	votes, err := h.Forum.CastVote(r.Context(), userID, payload.ThreadID, vote)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"votes": votes,
	})
}
