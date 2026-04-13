package server

import (
	"log"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jmoiron/sqlx"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/routes"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/storage"
)

type Server struct {
	Router *chi.Mux
	DB     *sqlx.DB
}

func New(cfg config.Config) *Server {
	db := storage.MustOpen(cfg.DBURL)
	if err := storage.EnsureSchema(db); err != nil {
		log.Fatalf("ensure schema: %v", err)
	}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedHeaders: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	}))

	r = routes.Build(r, cfg, db)

	return &Server{
		Router: r,
		DB:     db,
	}
}
