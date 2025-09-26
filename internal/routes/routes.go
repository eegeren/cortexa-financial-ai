package routes

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/handlers"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/middleware"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
)

func Build(r *chi.Mux, cfg config.Config, db *sqlx.DB) *chi.Mux {
	// services
	authSvc := services.NewAuthService(db, cfg)
	priceSvc := services.NewPriceService(cfg)
	signalSvc := services.NewSignalService(cfg)
	portfolioSvc := services.NewPortfolioService(db)
	webhookSvc := services.NewWebhookService(cfg)

	// handlers
	h := handlers.NewHandlers(authSvc, priceSvc, signalSvc, portfolioSvc, webhookSvc, cfg)

	r.Get("/health", h.Health)

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.JWT(authSvc))
		r.Get("/prices/{symbol}", h.GetPrices)
		r.Get("/signals/{symbol}", h.GetSignals)
		r.Get("/signals/{symbol}/stream", h.StreamSignal)
		r.Get("/signals/{symbol}/backtest", h.GetSignalBacktest)
		r.Get("/signals/{symbol}/backtest/sweep", h.GetSignalBacktestSweep)
		r.Get("/portfolio", h.GetPortfolio)
		r.Post("/portfolio/trade", h.CreateTrade)
		r.Post("/signals/{symbol}/auto-trade", h.AutoTradeSignal)
	})

	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.JWT(authSvc))
		r.With(middleware.AdminOnly).Get("/users", h.AdminUsers)
		r.With(middleware.AdminOnly).Patch("/users/{id}/role", h.AdminUpdateUserRole)
	})

	r.NotFound(http.NotFound)
	return r
}
