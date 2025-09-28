package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/server"
)

func main() {
	_ = godotenv.Load() // optional in local dev
	cfg := config.Load()
	log.Printf("AI service URL: %s", cfg.AIServiceURL)

	srv := server.New(cfg)
	log.Printf("starting api on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, srv.Router); err != nil {
		log.Fatal(err)
	}
}
