package services

import (
	"context"

	"github.com/jmoiron/sqlx"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
)

type PortfolioService struct {
	db *sqlx.DB
}

func NewPortfolioService(db *sqlx.DB) *PortfolioService {
	return &PortfolioService{db: db}
}

func (s *PortfolioService) GetPortfolio(ctx context.Context, userID int64) (models.Portfolio, error) {
	var trades []models.Trade
	err := s.db.SelectContext(ctx, &trades, `SELECT id,user_id,symbol,side,qty,price FROM trades WHERE user_id=$1 ORDER BY id DESC`, userID)
	if trades == nil {
		trades = make([]models.Trade, 0)
	}
	return models.Portfolio{UserID: userID, Trades: trades}, err
}

func (s *PortfolioService) CreateTrade(ctx context.Context, userID int64, symbol, side string, qty, price float64) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO trades(user_id,symbol,side,qty,price,created_at) VALUES($1,$2,$3,$4,$5,NOW())`,
		userID, symbol, side, qty, price)
	return err
}
