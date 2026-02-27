package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/models"
)

type BillingService struct {
	db  *sqlx.DB
	cfg config.Config
}

var ErrSubscriptionNotFound = errors.New("subscription not found")

func NewBillingService(db *sqlx.DB, cfg config.Config) *BillingService {
	return &BillingService{
		db:  db,
		cfg: cfg,
	}
}

func (s *BillingService) PaymentProvider() string {
	provider := strings.TrimSpace(strings.ToLower(s.cfg.PaymentProvider))
	switch provider {
	case "stripe", "paddle", "lemonsqueezy", "iyzico":
		return provider
	default:
		return "stripe"
	}
}

func (s *BillingService) GetPlans(ctx context.Context) ([]models.Plan, error) {
	plans := []models.Plan{}
	err := s.db.SelectContext(ctx, &plans, `SELECT id, code, name, description, amount_cents, currency, billing_interval, features, active, created_at, updated_at FROM plans WHERE active = TRUE ORDER BY amount_cents ASC`)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []models.Plan{}, nil
		}
		return nil, err
	}
	return plans, nil
}

func (s *BillingService) getPlanByCode(ctx context.Context, code string) (models.Plan, error) {
	var plan models.Plan
	err := s.db.GetContext(ctx, &plan, `SELECT id, code, name, description, amount_cents, currency, billing_interval, features, active, created_at, updated_at FROM plans WHERE code=$1`, strings.ToLower(strings.TrimSpace(code)))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return plan, fmt.Errorf("plan not found")
		}
		return plan, err
	}
	if !plan.Active {
		return plan, fmt.Errorf("plan inactive")
	}
	return plan, nil
}

func (s *BillingService) EnsureTrialSubscription(ctx context.Context, userID int64) error {
	if userID <= 0 {
		return fmt.Errorf("invalid user id")
	}

	email, err := s.lookupUserEmail(ctx, userID)
	if err != nil {
		return err
	}

	planCode := "starter"
	status := "trialing"
	trialDuration := time.Duration(s.cfg.DefaultTrialDays) * 24 * time.Hour
	trialEnds := time.Now().Add(trialDuration)
	periodEnd := trialEnds
	providerID := fmt.Sprintf("trial-%d", userID)

	if s.cfg.IsOwnerEmail(email) {
		planCode = "enterprise"
		status = "active"
		trialEnds = time.Time{}
		periodEnd = time.Now().Add(30 * 24 * time.Hour)
		providerID = fmt.Sprintf("owner-%d", userID)
	}

	plan, err := s.getPlanByCode(ctx, planCode)
	if err != nil {
		return err
	}

	var trialPtr *time.Time
	if !trialEnds.IsZero() {
		trialPtr = &trialEnds
	}

	_, err = s.db.ExecContext(ctx, `
        INSERT INTO subscriptions (user_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, provider_customer_id, provider_subscription_id)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status,
            trial_ends_at = EXCLUDED.trial_ends_at,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            provider_customer_id = EXCLUDED.provider_customer_id,
            provider_subscription_id = EXCLUDED.provider_subscription_id,
            updated_at = NOW()
    `, userID, plan.ID, status, trialPtr, periodEnd, fmt.Sprintf("cust-%d", userID), providerID)
	return err
}

func (s *BillingService) GetSubscriptionForUser(ctx context.Context, userID int64) (models.SubscriptionWithPlan, error) {
	var sub models.SubscriptionWithPlan
	err := s.db.GetContext(ctx, &sub, `
        SELECT
            s.id,
            s.user_id,
            s.plan_id,
            s.status,
            s.trial_ends_at,
            s.current_period_start,
            s.current_period_end,
            s.provider_customer_id,
            s.provider_subscription_id,
            s.cancel_at_period_end,
            s.created_at,
            s.updated_at,
            p.code AS plan_code,
            p.name AS plan_name
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = $1
        LIMIT 1
    `, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sub, ErrSubscriptionNotFound
		}
		return sub, err
	}

	if sub.Status == "trialing" && sub.TrialEndsAt != nil && time.Now().After(*sub.TrialEndsAt) {
		_, _ = s.db.ExecContext(ctx, `UPDATE subscriptions SET status='past_due', updated_at=NOW() WHERE id=$1`, sub.ID)
		sub.Status = "past_due"
	}

	return sub, nil
}

func (s *BillingService) CanAccessAssistant(ctx context.Context, userID int64) (bool, *models.SubscriptionWithPlan, error) {
	if s.cfg.PremiumDisabled {
		now := time.Now()
		placeholder := &models.SubscriptionWithPlan{
			Subscription: models.Subscription{
				UserID:                 userID,
				PlanID:                 0,
				Status:                 "active",
				ProviderCustomerID:     fmt.Sprintf("disabled-%d", userID),
				ProviderSubscriptionID: fmt.Sprintf("disabled-sub-%d", userID),
				CreatedAt:              now,
				UpdatedAt:              now,
			},
			PlanCode: "testing-disabled",
			PlanName: "Premium Disabled",
		}
		return true, placeholder, nil
	}

	sub, err := s.GetSubscriptionForUser(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrSubscriptionNotFound) {
			email, emailErr := s.lookupUserEmail(ctx, userID)
			if emailErr == nil && s.cfg.IsOwnerEmail(email) {
				planCode := "enterprise"
				planName := "Enterprise"
				var planID int64
				if plan, planErr := s.getPlanByCode(ctx, planCode); planErr == nil {
					planID = plan.ID
					planCode = plan.Code
					planName = plan.Name
				}
				placeholder := models.SubscriptionWithPlan{
					Subscription: models.Subscription{
						UserID:             userID,
						PlanID:             planID,
						Status:             "active",
						ProviderCustomerID: fmt.Sprintf("cust-%d", userID),
						CreatedAt:          time.Now(),
						UpdatedAt:          time.Now(),
					},
					PlanCode: planCode,
					PlanName: planName,
				}
				return true, &placeholder, nil
			}
			return false, nil, nil
		}
		return false, nil, err
	}

	email, emailErr := s.lookupUserEmail(ctx, userID)
	if emailErr == nil && s.cfg.IsOwnerEmail(email) {
		if sub.PlanCode != "enterprise" {
			if plan, planErr := s.getPlanByCode(ctx, "enterprise"); planErr == nil {
				_, _ = s.db.ExecContext(ctx, `
					UPDATE subscriptions
					SET plan_id=$1,
					    status='active',
					    trial_ends_at=NULL,
					    current_period_end=NOW() + INTERVAL '30 days',
					    updated_at=NOW()
					WHERE id=$2
				`, plan.ID, sub.ID)
				sub.PlanID = plan.ID
				sub.PlanCode = plan.Code
				sub.PlanName = plan.Name
			}
		}
		sub.Status = "active"
		return true, &sub, nil
	}

	now := time.Now()
	switch sub.Status {
	case "active":
		return true, &sub, nil
	case "trialing":
		if sub.TrialEndsAt == nil || sub.TrialEndsAt.After(now) {
			return true, &sub, nil
		}
		return false, &sub, nil
	default:
		return false, &sub, nil
	}
}

func (s *BillingService) CreateCheckoutSession(ctx context.Context, userID int64, planCode, successURL, cancelURL string) (models.CheckoutSession, error) {
	var session models.CheckoutSession
	if userID <= 0 {
		return session, fmt.Errorf("invalid user id")
	}
	plan, err := s.getPlanByCode(ctx, planCode)
	if err != nil {
		return session, err
	}

	provider := s.PaymentProvider()
	sessionID := uuid.NewString()

	checkoutURL := s.buildCheckoutURL(provider, sessionID, plan.Code, successURL, cancelURL)
	providerCustomerID := fmt.Sprintf("cust-%d", userID)

	_, err = s.db.ExecContext(ctx, `
        INSERT INTO subscriptions (user_id, plan_id, status, provider_customer_id, provider_subscription_id, current_period_start, current_period_end, trial_ends_at)
        VALUES ($1, $2, 'past_due', $3, $4, NOW(), NOW(), NULL)
        ON CONFLICT (user_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            status = 'past_due',
            provider_customer_id = EXCLUDED.provider_customer_id,
            provider_subscription_id = EXCLUDED.provider_subscription_id,
            trial_ends_at = NULL,
            updated_at = NOW()
    `, userID, plan.ID, providerCustomerID, sessionID)
	if err != nil {
		return session, err
	}

	session = models.CheckoutSession{
		SessionID:   sessionID,
		CheckoutURL: checkoutURL,
		Provider:    provider,
	}
	return session, nil
}

func (s *BillingService) buildCheckoutURL(provider, sessionID, planCode, successURL, cancelURL string) string {
	base := fmt.Sprintf("https://billing.%s.cortexa.ai", provider)
	params := []string{fmt.Sprintf("session_id=%s", sessionID), fmt.Sprintf("plan=%s", planCode)}
	if successURL != "" {
		params = append(params, "success="+urlEncode(successURL))
	}
	if cancelURL != "" {
		params = append(params, "cancel="+urlEncode(cancelURL))
	}
	return fmt.Sprintf("%s/checkout?%s", base, strings.Join(params, "&"))
}

func urlEncode(value string) string {
	return url.QueryEscape(value)
}

func (s *BillingService) PortalURL(ctx context.Context, userID int64) (string, error) {
	sub, err := s.GetSubscriptionForUser(ctx, userID)
	if err != nil {
		return "", err
	}
	provider := s.PaymentProvider()
	base := fmt.Sprintf("https://billing.%s.cortexa.ai", provider)
	customerID := sub.ProviderCustomerID
	if customerID == "" {
		customerID = fmt.Sprintf("cust-%d", userID)
	}
	return fmt.Sprintf("%s/portal?customer=%s", base, customerID), nil
}

type webhookEnvelope struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Data struct {
		SubscriptionID string     `json:"subscription_id"`
		CustomerID     string     `json:"customer_id"`
		UserID         int64      `json:"user_id"`
		PlanCode       string     `json:"plan_code"`
		Status         string     `json:"status"`
		TrialEndsAt    *time.Time `json:"trial_ends_at"`
		CurrentStart   *time.Time `json:"current_period_start"`
		CurrentEnd     *time.Time `json:"current_period_end"`
		Invoice        *struct {
			InvoiceID string     `json:"invoice_id"`
			Amount    int64      `json:"amount_cents"`
			Currency  string     `json:"currency"`
			Status    string     `json:"status"`
			HostedURL string     `json:"hosted_url"`
			PDFURL    string     `json:"pdf_url"`
			TaxAmount int64      `json:"tax_amount_cents"`
			IssuedAt  *time.Time `json:"issued_at"`
			DueAt     *time.Time `json:"due_at"`
		} `json:"invoice"`
	} `json:"data"`
}

func (s *BillingService) HandleWebhook(ctx context.Context, provider string, headers map[string]string, payload []byte) error {
	provider = strings.TrimSpace(strings.ToLower(provider))
	if provider == "" {
		provider = s.PaymentProvider()
	}

	if err := s.verifySignature(provider, headers, payload); err != nil {
		return err
	}

	var event webhookEnvelope
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}
	if event.ID == "" {
		return fmt.Errorf("missing event id")
	}
	if event.Data.SubscriptionID == "" {
		return fmt.Errorf("missing subscription id")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var exists bool
	if err := tx.GetContext(ctx, &exists, `SELECT EXISTS (SELECT 1 FROM payment_events WHERE event_id=$1)`, event.ID); err != nil {
		return err
	}
	if exists {
		return nil
	}

	if _, err := tx.ExecContext(ctx, `INSERT INTO payment_events (provider, event_id) VALUES ($1, $2)`, provider, event.ID); err != nil {
		return err
	}

	planCode := event.Data.PlanCode
	if planCode == "" {
		planCode = "starter"
	}
	plan, err := s.getPlanByCode(ctx, planCode)
	if err != nil {
		return err
	}

	status := normalizeStatus(event.Data.Status)
	trialEndsAt := event.Data.TrialEndsAt
	if status == "trialing" && trialEndsAt == nil {
		tmp := time.Now().Add(time.Duration(s.cfg.DefaultTrialDays) * 24 * time.Hour)
		trialEndsAt = &tmp
	}

	currentStart := event.Data.CurrentStart
	if currentStart == nil {
		now := time.Now()
		currentStart = &now
	}
	currentEnd := event.Data.CurrentEnd
	if currentEnd == nil {
		now := time.Now().Add(30 * 24 * time.Hour)
		currentEnd = &now
	}

	res, err := tx.ExecContext(ctx, `
        UPDATE subscriptions
        SET status=$1,
            plan_id=$2,
            trial_ends_at=$3,
            current_period_start=$4,
            current_period_end=$5,
            provider_customer_id=COALESCE(NULLIF($6, ''), provider_customer_id),
            updated_at=NOW()
        WHERE provider_subscription_id=$7
    `, status, plan.ID, trialEndsAt, currentStart, currentEnd, event.Data.CustomerID, event.Data.SubscriptionID)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		_, err = tx.ExecContext(ctx, `
            INSERT INTO subscriptions (user_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, provider_customer_id, provider_subscription_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
                plan_id = EXCLUDED.plan_id,
                status = EXCLUDED.status,
                trial_ends_at = EXCLUDED.trial_ends_at,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                provider_customer_id = EXCLUDED.provider_customer_id,
                provider_subscription_id = EXCLUDED.provider_subscription_id,
                updated_at = NOW()
        `, event.Data.UserID, plan.ID, status, trialEndsAt, currentStart, currentEnd, event.Data.CustomerID, event.Data.SubscriptionID)
		if err != nil {
			return err
		}
	}

	if event.Data.Invoice != nil {
		invoice := event.Data.Invoice
		if _, err := tx.ExecContext(ctx, `
            INSERT INTO invoices (subscription_id, provider_invoice_id, amount_cents, currency, status, hosted_invoice_url, pdf_url, tax_amount_cents, issued_at, due_at)
            SELECT s.id, $2, $3, $4, $5, $6, $7, $8, $9, $10
            FROM subscriptions s
            WHERE s.provider_subscription_id=$1
            ON CONFLICT (provider_invoice_id) DO UPDATE SET
                amount_cents = EXCLUDED.amount_cents,
                currency = EXCLUDED.currency,
                status = EXCLUDED.status,
                hosted_invoice_url = EXCLUDED.hosted_invoice_url,
                pdf_url = EXCLUDED.pdf_url,
                tax_amount_cents = EXCLUDED.tax_amount_cents,
                issued_at = EXCLUDED.issued_at,
                due_at = EXCLUDED.due_at
        `, event.Data.SubscriptionID, invoice.InvoiceID, invoice.Amount, invoice.Currency, invoice.Status, invoice.HostedURL, invoice.PDFURL, invoice.TaxAmount, invoice.IssuedAt, invoice.DueAt); err != nil {
			return err
		}
	}

	role := "user"
	if status == "active" {
		role = "premium"
	}
	if status == "canceled" || status == "past_due" {
		role = "user"
	}
	userID := event.Data.UserID
	if userID == 0 {
		if err := tx.GetContext(ctx, &userID, `SELECT user_id FROM subscriptions WHERE provider_subscription_id=$1`, event.Data.SubscriptionID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE users SET role=$1 WHERE id=$2`, role, userID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func normalizeStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "trialing", "past_due", "canceled":
		return strings.ToLower(strings.TrimSpace(status))
	case "trial":
		return "trialing"
	case "cancelled":
		return "canceled"
	default:
		return "past_due"
	}
}

func (s *BillingService) verifySignature(provider string, headers map[string]string, payload []byte) error {
	normalized := map[string]string{}
	for k, v := range headers {
		normalized[strings.ToLower(k)] = v
	}

	secret := ""
	headerName := ""
	switch provider {
	case "stripe":
		secret = s.cfg.StripeWebhookSecret
		headerName = "stripe-signature"
	case "paddle":
		secret = s.cfg.PaddleWebhookSecret
		headerName = "paddle-signature"
	case "lemonsqueezy":
		secret = s.cfg.LemonSqueezyWebhookSecret
		headerName = "x-signature"
	case "iyzico":
		secret = s.cfg.IyzicoWebhookSecret
		headerName = "iyzico-signature"
	default:
		return nil
	}

	if secret == "" {
		return nil
	}
	signature := normalized[headerName]
	if signature == "" {
		return fmt.Errorf("missing signature header")
	}

	expected := computeHMAC([]byte(secret), payload)

	token := ""
	for _, part := range strings.Split(signature, ",") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(kv[0]))
		value := strings.TrimSpace(kv[1])
		if key == "signature" || key == "v1" || token == "" {
			token = value
			if key == "v1" {
				break
			}
		}
	}
	if token == "" {
		token = strings.TrimSpace(signature)
	}

	if !hmac.Equal([]byte(strings.ToLower(token)), []byte(strings.ToLower(expected))) {
		return fmt.Errorf("invalid signature")
	}
	return nil
}

func computeHMAC(secret, payload []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *BillingService) ActiveInvoices(ctx context.Context, userID int64) ([]models.Invoice, error) {
	invoices := []models.Invoice{}
	err := s.db.SelectContext(ctx, &invoices, `
        SELECT i.id, i.subscription_id, i.provider_invoice_id, i.amount_cents, i.currency, i.status, i.hosted_invoice_url, i.pdf_url, i.tax_amount_cents, i.created_at, i.issued_at, i.due_at
        FROM invoices i
        JOIN subscriptions s ON s.id = i.subscription_id
        WHERE s.user_id = $1
        ORDER BY i.created_at DESC
        LIMIT 25
    `, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []models.Invoice{}, nil
		}
		return nil, err
	}
	return invoices, nil
}

func (s *BillingService) UpsertBillingProfile(ctx context.Context, profile models.BillingProfile) error {
	if profile.UserID == 0 {
		return fmt.Errorf("missing user id")
	}
	_, err := s.db.ExecContext(ctx, `
        INSERT INTO billing_profiles (user_id, country, vat_id, company_name, address_line1, address_line2, city, postal_code)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (user_id) DO UPDATE SET
            country = EXCLUDED.country,
            vat_id = EXCLUDED.vat_id,
            company_name = EXCLUDED.company_name,
            address_line1 = EXCLUDED.address_line1,
            address_line2 = EXCLUDED.address_line2,
            city = EXCLUDED.city,
            postal_code = EXCLUDED.postal_code,
            updated_at = NOW()
    `, profile.UserID, profile.Country, profile.VATID, profile.CompanyName, profile.AddressLine1, profile.AddressLine2, profile.City, profile.PostalCode)
	return err
}

func (s *BillingService) GetBillingProfile(ctx context.Context, userID int64) (models.BillingProfile, error) {
	var profile models.BillingProfile
	err := s.db.GetContext(ctx, &profile, `
        SELECT id, user_id, country, vat_id, company_name, address_line1, address_line2, city, postal_code, created_at, updated_at
        FROM billing_profiles
        WHERE user_id = $1
        LIMIT 1
    `, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.BillingProfile{UserID: userID}, nil
		}
		return profile, err
	}
	return profile, nil
}

func (s *BillingService) lookupUserEmail(ctx context.Context, userID int64) (string, error) {
	var email string
	if err := s.db.GetContext(ctx, &email, `SELECT email FROM users WHERE id=$1`, userID); err != nil {
		return "", err
	}
	return email, nil
}
