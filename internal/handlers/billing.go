package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
)

type checkoutRequest struct {
	PlanCode   string `json:"plan_code"`
	SuccessURL string `json:"success_url"`
	CancelURL  string `json:"cancel_url"`
}

type billingProfilePayload struct {
	Country      string `json:"country"`
	VATID        string `json:"vat_id"`
	CompanyName  string `json:"company_name"`
	AddressLine1 string `json:"address_line1"`
	AddressLine2 string `json:"address_line2"`
	City         string `json:"city"`
	PostalCode   string `json:"postal_code"`
}

func (h *Handlers) BillingPlans(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	plans, err := h.Billing.GetPlans(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"plans": plans})
}

func (h *Handlers) BillingCheckout(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req checkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	planCode := strings.TrimSpace(strings.ToLower(req.PlanCode))
	if planCode == "" {
		http.Error(w, "plan_code required", http.StatusBadRequest)
		return
	}
	session, err := h.Billing.CreateCheckoutSession(r.Context(), userID, planCode, req.SuccessURL, req.CancelURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

func (h *Handlers) BillingSubscription(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	canAccess, subscription, err := h.Billing.CanAccessAssistant(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if subscription == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"subscription": nil,
			"access":       map[string]any{"can_access": false, "reason": "missing"},
		})
		return
	}
	remainingDays := 0
	if subscription.TrialEndsAt != nil {
		remaining := int(time.Until(*subscription.TrialEndsAt).Hours() / 24)
		if remaining > 0 {
			remainingDays = remaining
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subscription": subscription,
		"access": map[string]any{
			"can_access":               canAccess,
			"trial_days_remaining":     remainingDays,
			"status":                   subscription.Status,
			"plan":                     subscription.PlanCode,
			"provider_subscription_id": subscription.ProviderSubscriptionID,
		},
	})
}

func (h *Handlers) BillingPortal(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	url, err := h.Billing.PortalURL(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"portal_url": url})
}

func (h *Handlers) BillingInvoices(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	invoices, err := h.Billing.ActiveInvoices(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invoices": invoices})
}

func (h *Handlers) BillingProfile(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	profile, err := h.Billing.GetBillingProfile(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (h *Handlers) UpdateBillingProfile(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := h.UserIDFromCtx(r.Context())
	if userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload billingProfilePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	profile := models.BillingProfile{
		UserID:       userID,
		Country:      strings.TrimSpace(payload.Country),
		VATID:        strings.TrimSpace(payload.VATID),
		CompanyName:  strings.TrimSpace(payload.CompanyName),
		AddressLine1: strings.TrimSpace(payload.AddressLine1),
		AddressLine2: strings.TrimSpace(payload.AddressLine2),
		City:         strings.TrimSpace(payload.City),
		PostalCode:   strings.TrimSpace(payload.PostalCode),
	}
	if err := h.Billing.UpsertBillingProfile(r.Context(), profile); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handlers) PaymentWebhook(w http.ResponseWriter, r *http.Request) {
	if h.Billing == nil {
		http.Error(w, "billing unavailable", http.StatusServiceUnavailable)
		return
	}
	provider := r.URL.Query().Get("provider")
	if provider == "" {
		provider = r.Header.Get("X-Provider")
	}
	headers := map[string]string{}
	for key, value := range r.Header {
		if len(value) == 0 {
			continue
		}
		headers[key] = value[0]
	}
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if err := h.Billing.HandleWebhook(r.Context(), provider, headers, payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "received"})
}
