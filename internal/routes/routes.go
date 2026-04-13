package routes

import (
	"context"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	botpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/bot"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/handlers"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/middleware"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
	validatorpkg "github.com/cortexa-labs/cortexa-trade-ai-backend/internal/validator"
)

func Build(r *chi.Mux, cfg config.Config, db *sqlx.DB) *chi.Mux {
	// services
	authSvc := services.NewAuthService(db, cfg)
	priceSvc := services.NewPriceService(cfg)
	signalSvc := services.NewSignalService(cfg)
	forumSvc := services.NewForumService(db)
	portfolioSvc := services.NewPortfolioService(db)
	usageSvc := services.NewUsageService(db)
	webhookSvc := services.NewWebhookService(cfg)
	billingSvc := services.NewBillingService(db, cfg)
	chatSvc := services.NewChatService(cfg)
	logger, _ := zap.NewProduction()
	botSvc := botpkg.NewService(db, cfg, logger)
	botExec := botpkg.NewBinanceExecutor(botSvc, logger)
	botEngine := botpkg.NewEngine(botSvc, botExec, logger)
	validator := validatorpkg.NewOutcomeTracker(db, cfg, logger)
	go func() {
		if err := botEngine.Start(context.Background()); err != nil && err != context.Canceled {
			logger.Warn("bot engine stopped", zap.Error(err))
		}
	}()
	go func() {
		if err := validator.Start(context.Background()); err != nil && err != context.Canceled {
			logger.Warn("outcome tracker stopped", zap.Error(err))
		}
	}()

	// handlers
	h := handlers.NewHandlers(authSvc, priceSvc, signalSvc, forumSvc, portfolioSvc, usageSvc, webhookSvc, billingSvc, chatSvc, botSvc, botExec, validator, cfg)

	r.Get("/health", h.Health)
	r.Get("/healthz", h.Healthz)
	r.Post("/api/webhooks/payment", h.PaymentWebhook)
	r.Get("/api/billing/demo-activate", h.BillingDemoActivate)
	r.Get("/api/stats/overview", h.StatsOverview)

	r.Route("/api/public", func(r chi.Router) {
		r.Get("/prices/{symbol}", h.GetPrices)
		r.Get("/market/symbols", h.GetMarketSymbols)
		r.Get("/market/summary", h.GetMarketSummary)
		r.Get("/market/fear-greed", h.GetFearGreed)
		r.Get("/market/etf-flows", h.GetETFFlows)
		r.Get("/market/liquidations", h.GetLiquidations)
		r.Get("/market/whale-alerts", h.GetWhaleAlerts)
		r.Get("/market/on-chain", h.GetOnChainMetrics)
		r.Get("/market/volume-spikes", h.GetVolumeSpikes)
		r.Get("/news", h.GetNews)
		r.Get("/stats/by-confidence", h.StatsByConfidence)
		r.Get("/stats/recent-outcomes", h.RecentOutcomes)
		r.Get("/stats/overview", h.StatsOverview)
	})

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/google", h.GoogleAuth)
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.JWT(authSvc))
		r.Get("/prices/{symbol}", h.GetPrices)
		r.Get("/market/symbols", h.GetMarketSymbols)
		r.Get("/market/summary", h.GetMarketSummary)
		r.Get("/news", h.GetNews)
		r.Get("/signals", h.GetSignalsBatch)
		r.Get("/stats/overview", h.StatsOverview)
		r.Get("/stats/by-pair", h.StatsByPair)
		r.Get("/stats/by-timeframe", h.StatsByTimeframe)
		r.Get("/stats/by-confidence", h.StatsByConfidence)
		r.Get("/stats/recent-outcomes", h.RecentOutcomes)
		r.Get("/signals/{symbol}", h.GetSignals)
		r.Get("/usage/signals", h.GetSignalUsage)
		r.Get("/signals/{symbol}/stream", h.StreamSignal)
		r.Get("/signals/{symbol}/backtest", h.GetSignalBacktest)
		r.Get("/signals/{symbol}/backtest/sweep", h.GetSignalBacktestSweep)
		r.Post("/insight", h.GetInsight)
		r.Get("/portfolio", h.GetPortfolio)
		r.Post("/portfolio/trade", h.CreateTrade)
		r.Post("/signals/{symbol}/auto-trade", h.AutoTradeSignal)
		r.Post("/chat", h.ChatCompletion)
		r.Get("/bot/settings", h.GetBotSettings)
		r.Put("/bot/settings", h.UpdateBotSettings)
		r.Post("/bot/test-connection", h.TestBotConnection)
		r.Post("/bot/toggle", h.ToggleBot)
		r.Get("/bot/orders", h.GetBotOrders)
		r.Delete("/bot/orders/{id}", h.CancelBotOrder)
		r.Get("/billing/plans", h.BillingPlans)
		r.Post("/billing/checkout", h.BillingCheckout)
		r.Get("/billing/subscription", h.BillingSubscription)
		r.Get("/billing/portal", h.BillingPortal)
		r.Get("/billing/invoices", h.BillingInvoices)
		r.Get("/billing/profile", h.BillingProfile)
		r.Put("/billing/profile", h.UpdateBillingProfile)

		// Market Intelligence
		r.Get("/market/fear-greed", h.GetFearGreed)
		r.Get("/market/etf-flows", h.GetETFFlows)
		r.Get("/market/liquidations", h.GetLiquidations)
		r.Get("/market/whale-alerts", h.GetWhaleAlerts)
		r.Get("/market/on-chain", h.GetOnChainMetrics)
		r.Get("/market/volume-spikes", h.GetVolumeSpikes)
	})

	// Forum (placeholder API routes; replace with real handlers later)
	r.Route("/api/forum", func(r chi.Router) {
		r.Get("/threads", h.GetForumThreads)
		r.With(middleware.RequireAuth(authSvc)).Post("/comments", h.CreateForumComment)
		r.With(middleware.RequireAuth(authSvc)).Post("/votes", h.CreateForumVote)
	})

	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.JWT(authSvc))
		r.With(middleware.AdminOnly).Get("/users", h.AdminUsers)
		r.With(middleware.AdminOnly).Patch("/users/{id}/role", h.AdminUpdateUserRole)
	})

	// Frontend static dosyaları (FRONTEND_DIR env varı ayarlıysa ya da ./frontend/dist varsa)
	frontendDir := os.Getenv("FRONTEND_DIR")
	if frontendDir == "" {
		frontendDir = "./frontend/dist"
	}
	if info, err := os.Stat(frontendDir); err == nil && info.IsDir() {
		fs := http.FileServer(http.Dir(frontendDir))
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			// API ve auth rotaları yukarıda ele alındı, buraya gelmez
			// SPA için: dosya yoksa index.html döndür
			path := frontendDir + req.URL.Path
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, req, frontendDir+"/index.html")
				return
			}
			fs.ServeHTTP(w, req)
		})
	} else {
		r.NotFound(http.NotFound)
	}
	return r
}
