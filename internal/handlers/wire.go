package handlers

import (
	"context"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/middleware"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
)

type Handlers struct {
	Auth      *services.AuthService
	Price     *services.PriceService
	Signal    *services.SignalService
	Portfolio *services.PortfolioService
	Webhook   *services.WebhookService
	Billing   *services.BillingService
	Chat      *services.ChatService
	Cfg       config.Config
}

func NewHandlers(a *services.AuthService, p *services.PriceService, s *services.SignalService, pf *services.PortfolioService, wh *services.WebhookService, bill *services.BillingService, chat *services.ChatService, cfg config.Config) *Handlers {
	return &Handlers{Auth: a, Price: p, Signal: s, Portfolio: pf, Webhook: wh, Billing: bill, Chat: chat, Cfg: cfg}
}

func (h *Handlers) UserIDFromCtx(ctx context.Context) int64 {
	if ctx == nil {
		return 0
	}
	m, ok := ctx.Value(middleware.UserIDKey).(map[string]any)
	if !ok {
		return 0
	}
	if id, ok := m["id"].(int64); ok {
		return id
	}
	if idf, ok := m["id"].(float64); ok {
		return int64(idf)
	}
	return 0
}

func (h *Handlers) RoleFromCtx(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	m, ok := ctx.Value(middleware.UserIDKey).(map[string]any)
	if !ok {
		return ""
	}
	if role, ok := m["role"].(string); ok {
		return role
	}
	return ""
}
