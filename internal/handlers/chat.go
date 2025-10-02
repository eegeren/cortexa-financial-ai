package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
)

type chatPayload struct {
	Messages    []services.ChatMessage `json:"messages"`
	Model       string                 `json:"model,omitempty"`
	Temperature *float32               `json:"temperature,omitempty"`
	MaxTokens   *int                   `json:"max_tokens,omitempty"`
}

func (h *Handlers) ChatCompletion(w http.ResponseWriter, r *http.Request) {
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.Chat == nil {
		http.Error(w, "assistant unavailable", http.StatusServiceUnavailable)
		return
	}
	var payload chatPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	if len(payload.Messages) == 0 {
		http.Error(w, "messages required", http.StatusBadRequest)
		return
	}
	// Basic sanitisation: trim whitespace and ensure roles are valid
	sanitized := make([]services.ChatMessage, 0, len(payload.Messages))
	for _, msg := range payload.Messages {
		role := strings.ToLower(strings.TrimSpace(msg.Role))
		if role != "user" && role != "assistant" && role != "system" {
			role = "user"
		}
		content := strings.TrimSpace(msg.Content)
		if content == "" {
			continue
		}
		sanitized = append(sanitized, services.ChatMessage{Role: role, Content: content})
	}
	if len(sanitized) == 0 {
		http.Error(w, "messages required", http.StatusBadRequest)
		return
	}

	allowed, subscription, err := h.Billing.CanAccessAssistant(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !allowed {
		reason := "subscription inactive"
		if subscription != nil {
			reason = subscription.Status
		}
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"ok":     false,
			"reason": reason,
		})
		return
	}

	chatReq := services.ChatRequest{
		Model:    payload.Model,
		Messages: sanitized,
	}
	if payload.Temperature != nil {
		chatReq.Temperature = *payload.Temperature
	}
	if payload.MaxTokens != nil {
		chatReq.MaxTokens = *payload.MaxTokens
	}

	reply, err := h.Chat.Chat(r.Context(), chatReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"reply":  reply,
		"status": "completed",
	})
}
