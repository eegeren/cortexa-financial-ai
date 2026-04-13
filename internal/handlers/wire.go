package handlers

import (
	"context"

	botpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/bot"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/middleware"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
	validatorpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/validator"
)

type Handlers struct {
	Auth      *services.AuthService
	Price     *services.PriceService
	Signal    *services.SignalService
	Forum     *services.ForumService
	Portfolio *services.PortfolioService
	Usage     *services.UsageService
	Webhook   *services.WebhookService
	Billing   *services.BillingService
	Chat      *services.ChatService
	Bot       *botpkg.Service
	BotExec   *botpkg.BinanceExecutor
	Validator *validatorpkg.OutcomeTracker
	Cfg       config.Config
}

func NewHandlers(a *services.AuthService, p *services.PriceService, s *services.SignalService, forum *services.ForumService, pf *services.PortfolioService, usage *services.UsageService, wh *services.WebhookService, bill *services.BillingService, chat *services.ChatService, botService *botpkg.Service, botExec *botpkg.BinanceExecutor, validator *validatorpkg.OutcomeTracker, cfg config.Config) *Handlers {
	return &Handlers{Auth: a, Price: p, Signal: s, Forum: forum, Portfolio: pf, Usage: usage, Webhook: wh, Billing: bill, Chat: chat, Bot: botService, BotExec: botExec, Validator: validator, Cfg: cfg}
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
