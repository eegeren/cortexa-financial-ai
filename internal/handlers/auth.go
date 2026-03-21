package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerReq struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Phone        string `json:"phone"`
	KvkkAccepted bool   `json:"kvkk_accepted"`
}

type authResp struct {
	Token string `json:"token"`
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
		http.Error(w, "email and password required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" {
		http.Error(w, "first and last name required", http.StatusBadRequest)
		return
	}
	if !req.KvkkAccepted {
		http.Error(w, "kvkk consent required", http.StatusBadRequest)
		return
	}
	userID, err := h.Auth.Register(
		r.Context(),
		strings.TrimSpace(req.Email),
		req.Password,
		req.FirstName,
		req.LastName,
		req.Phone,
		req.KvkkAccepted,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if h.Billing != nil && userID > 0 {
		if err := h.Billing.EnsureTrialSubscription(r.Context(), userID); err != nil {
			// Fail softly — log but don't block registration
			log.Printf("billing trial setup failed: %v", err)
		}
	}
	writeJSON(w, http.StatusCreated, map[string]string{"message": "registered"})
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	u, err := h.Auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	t, _ := h.Auth.GenerateToken(u)
	writeJSON(w, http.StatusOK, authResp{Token: t})
}
