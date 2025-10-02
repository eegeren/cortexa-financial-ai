package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (h *Handlers) AdminUsers(w http.ResponseWriter, r *http.Request) {
	summary, err := h.Auth.AdminUserSummaries(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *Handlers) AdminUpdateUserRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}

	var payload struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(payload.Role) == "" {
		http.Error(w, "role is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	actorRole := h.RoleFromCtx(ctx)
	if actorRole != "admin" {
		actorID := h.UserIDFromCtx(ctx)
		actor, err := h.Auth.GetUserByID(ctx, actorID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !h.Cfg.IsOwnerEmail(actor.Email) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	updated, err := h.Auth.UpdateUserRole(ctx, userID, payload.Role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
