package services

import (
	"context"
	"errors"
	"time"

	"github.com/jmoiron/sqlx"
)

const FreeDailySignalLimit = 10

var ErrDailyLimitReached = errors.New("daily_limit_reached")

type UsageSnapshot struct {
	Used      int       `json:"used"`
	Limit     int       `json:"limit"`
	Remaining int       `json:"remaining"`
	IsPremium bool      `json:"is_premium"`
	ResetAt   time.Time `json:"reset_at"`
}

type UsageService struct {
	db *sqlx.DB
}

func NewUsageService(db *sqlx.DB) *UsageService {
	return &UsageService{db: db}
}

func usageDay(now time.Time) time.Time {
	utc := now.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func nextResetAt(now time.Time) time.Time {
	return usageDay(now).Add(24 * time.Hour)
}

func (s *UsageService) CurrentSignalUsage(ctx context.Context, userID int64, isPremium bool) (UsageSnapshot, error) {
	now := time.Now().UTC()
	snapshot := UsageSnapshot{
		Limit:     FreeDailySignalLimit,
		IsPremium: isPremium,
		ResetAt:   nextResetAt(now),
	}
	if isPremium || userID == 0 {
		return snapshot, nil
	}

	var used int
	err := s.db.GetContext(ctx, &used, `
		SELECT analyses_used
		FROM signal_daily_usage
		WHERE user_id=$1 AND usage_date=$2
	`, userID, usageDay(now))
	if err != nil {
		used = 0
	}

	snapshot.Used = used
	snapshot.Remaining = maxInt(0, snapshot.Limit-used)
	return snapshot, nil
}

func (s *UsageService) CheckAndIncrementSignalUsage(ctx context.Context, userID int64, isPremium bool) (UsageSnapshot, error) {
	now := time.Now().UTC()
	snapshot := UsageSnapshot{
		Limit:     FreeDailySignalLimit,
		IsPremium: isPremium,
		ResetAt:   nextResetAt(now),
	}
	if isPremium || userID == 0 {
		return snapshot, nil
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return snapshot, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	day := usageDay(now)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO signal_daily_usage (user_id, usage_date, analyses_used, updated_at)
		VALUES ($1, $2, 0, NOW())
		ON CONFLICT (user_id, usage_date) DO NOTHING
	`, userID, day); err != nil {
		return snapshot, err
	}

	var used int
	if err := tx.GetContext(ctx, &used, `
		SELECT analyses_used
		FROM signal_daily_usage
		WHERE user_id=$1 AND usage_date=$2
		FOR UPDATE
	`, userID, day); err != nil {
		return snapshot, err
	}

	if used >= FreeDailySignalLimit {
		snapshot.Used = used
		snapshot.Remaining = 0
		return snapshot, ErrDailyLimitReached
	}

	used++
	if _, err := tx.ExecContext(ctx, `
		UPDATE signal_daily_usage
		SET analyses_used=$3, updated_at=NOW()
		WHERE user_id=$1 AND usage_date=$2
	`, userID, day, used); err != nil {
		return snapshot, err
	}

	if err := tx.Commit(); err != nil {
		return snapshot, err
	}

	snapshot.Used = used
	snapshot.Remaining = maxInt(0, snapshot.Limit-used)
	return snapshot, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
