package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/pkg/jwt"
)

type AuthService struct {
	db  *sqlx.DB
	cfg config.Config
}

func NewAuthService(db *sqlx.DB, cfg config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func (s *AuthService) Register(ctx context.Context, email, password, firstName, lastName, phone string, kvkkAccepted bool) (int64, error) {
	if !kvkkAccepted {
		return 0, fmt.Errorf("kvkk consent required")
	}
	email = strings.TrimSpace(email)
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	if email == "" || firstName == "" || lastName == "" {
		return 0, fmt.Errorf("missing required fields")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return 0, err
	}
	var phonePtr *string
	trimmedPhone := strings.TrimSpace(phone)
	if trimmedPhone != "" {
		phonePtr = &trimmedPhone
	}
	var userID int64
	err = s.db.QueryRowContext(ctx, `
	    INSERT INTO users(email,password_hash,role,created_at,first_name,last_name,phone,kvkk_accepted,kvkk_accepted_at)
	    VALUES($1,$2,'user',NOW(),$3,$4,$5,true,NOW())
	    RETURNING id
	`,
		email, string(hash), firstName, lastName, phonePtr,
	).Scan(&userID)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return 0, fmt.Errorf("an account with this email already exists")
		}
		return 0, err
	}
	return userID, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (models.User, error) {
	var u models.User
	err := s.db.GetContext(ctx, &u, `SELECT id,email,password_hash,role FROM users WHERE email=$1`, email)
	if err != nil {
		return u, err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)) != nil {
		return u, errors.New("invalid credentials")
	}
	if s.cfg.IsOwnerEmail(u.Email) {
		if u.Role != "premium" {
			if _, err := s.db.ExecContext(ctx, `UPDATE users SET role='premium' WHERE id=$1`, u.ID); err == nil {
				u.Role = "premium"
			}
		} else {
			u.Role = "premium"
		}
	}
	return u, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, id int64) (models.User, error) {
	var u models.User
	err := s.db.GetContext(ctx, &u, `SELECT id,email,role FROM users WHERE id=$1`, id)
	if err != nil {
		return u, err
	}
	return u, nil
}

func (s *AuthService) UpdateUserRole(ctx context.Context, userID int64, role string) (models.User, error) {
	allowed := map[string]bool{"user": true, "premium": true}
	role = strings.ToLower(strings.TrimSpace(role))
	if !allowed[role] {
		return models.User{}, fmt.Errorf("invalid role")
	}

	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return user, err
	}

	if s.cfg.IsOwnerEmail(user.Email) {
		role = "premium"
	}

	if role != user.Role {
		if _, err := s.db.ExecContext(ctx, `UPDATE users SET role=$1 WHERE id=$2`, role, userID); err != nil {
			return user, err
		}
		user.Role = role
	}

	return user, nil
}

type AdminUserSummary struct {
	ID          int64      `json:"id"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	Plan        string     `json:"plan"`
	MonthlyFee  float64    `json:"monthly_fee"`
	Status      string     `json:"status"`
	Seats       string     `json:"seats"`
	TotalTrades int        `json:"total_trades"`
	Volume      float64    `json:"volume"`
	LastTradeAt *time.Time `json:"last_trade_at"`
	CreatedAt   time.Time  `json:"created_at"`
	NextRenewal time.Time  `json:"next_renewal"`
}

func (s *AuthService) AdminUserSummaries(ctx context.Context) ([]AdminUserSummary, error) {
	rows := []struct {
		ID          int64      `db:"id"`
		Email       string     `db:"email"`
		Role        string     `db:"role"`
		CreatedAt   time.Time  `db:"created_at"`
		TotalTrades int        `db:"total_trades"`
		Volume      float64    `db:"volume"`
		LastTradeAt *time.Time `db:"last_trade_at"`
	}{}

	err := s.db.SelectContext(ctx, &rows, `
        SELECT
            u.id,
            u.email,
            u.role,
            u.created_at,
            COALESCE(COUNT(t.id), 0) AS total_trades,
            COALESCE(SUM(t.qty * t.price), 0) AS volume,
            MAX(t.created_at) AS last_trade_at
        FROM users u
        LEFT JOIN trades t ON t.user_id = u.id
        GROUP BY u.id
        ORDER BY u.id ASC
    `)
	if err != nil {
		if err == sql.ErrNoRows {
			return []AdminUserSummary{}, nil
		}
		return nil, err
	}

	now := time.Now()
	summaries := make([]AdminUserSummary, 0, len(rows))
	for _, row := range rows {
		plan := "Trader Pro Trial"
		monthlyFee := 0.0
		status := "Trial"
		seats := "Single seat"
		renewal := row.CreatedAt.Add(14 * 24 * time.Hour)

		if s.cfg.IsOwnerEmail(row.Email) {
			plan = "Premium Access"
			monthlyFee = 499
			status = "Active"
			seats = "Unlimited seats"
			renewal = now.Add(30 * 24 * time.Hour)
		}

		if row.Role == "premium" {
			plan = "Premium Access"
			if monthlyFee == 0 {
				monthlyFee = 499
			}
			if status == "Trial" {
				status = "Active"
			}
			if seats == "Single seat" {
				seats = "Unlimited seats"
			}
			renewal = now.Add(30 * 24 * time.Hour)
		}

		summaries = append(summaries, AdminUserSummary{
			ID:          row.ID,
			Email:       row.Email,
			Role:        row.Role,
			Plan:        plan,
			MonthlyFee:  monthlyFee,
			Status:      status,
			Seats:       seats,
			TotalTrades: row.TotalTrades,
			Volume:      row.Volume,
			LastTradeAt: row.LastTradeAt,
			CreatedAt:   row.CreatedAt,
			NextRenewal: renewal,
		})
	}
	return summaries, nil
}

func (s *AuthService) GenerateToken(u models.User) (string, error) {
	claims := map[string]any{
		"uid":  u.ID,
		"role": u.Role,
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	}
	return jwt.Sign(claims, s.cfg.JWTSecret)
}

func (s *AuthService) ParseToken(tok string) (int64, string, error) {
	c, err := jwt.Parse(tok, s.cfg.JWTSecret)
	if err != nil {
		return 0, "", err
	}
	uid, _ := c["uid"].(float64)
	role, _ := c["role"].(string)
	return int64(uid), role, nil
}

func (s *AuthService) ListUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := s.db.SelectContext(ctx, &users, `SELECT id,email,role FROM users ORDER BY id DESC LIMIT 100`)
	if err == sql.ErrNoRows {
		return []models.User{}, nil
	}
	return users, err
}
