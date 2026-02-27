package models

import "time"

type Plan struct {
	ID              int64     `db:"id" json:"id"`
	Code            string    `db:"code" json:"code"`
	Name            string    `db:"name" json:"name"`
	Description     string    `db:"description" json:"description"`
	AmountCents     int64     `db:"amount_cents" json:"amount_cents"`
	Currency        string    `db:"currency" json:"currency"`
	BillingInterval string    `db:"billing_interval" json:"billing_interval"`
	Features        []string  `db:"features" json:"features"`
	Active          bool      `db:"active" json:"active"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type Subscription struct {
	ID                     int64      `db:"id" json:"id"`
	UserID                 int64      `db:"user_id" json:"user_id"`
	PlanID                 int64      `db:"plan_id" json:"plan_id"`
	Status                 string     `db:"status" json:"status"`
	TrialEndsAt            *time.Time `db:"trial_ends_at" json:"trial_ends_at"`
	CurrentPeriodStart     *time.Time `db:"current_period_start" json:"current_period_start"`
	CurrentPeriodEnd       *time.Time `db:"current_period_end" json:"current_period_end"`
	ProviderCustomerID     string     `db:"provider_customer_id" json:"provider_customer_id"`
	ProviderSubscriptionID string     `db:"provider_subscription_id" json:"provider_subscription_id"`
	CancelAtPeriodEnd      bool       `db:"cancel_at_period_end" json:"cancel_at_period_end"`
	CreatedAt              time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt              time.Time  `db:"updated_at" json:"updated_at"`
}

type Invoice struct {
	ID                int64      `db:"id" json:"id"`
	SubscriptionID    int64      `db:"subscription_id" json:"subscription_id"`
	ProviderInvoiceID string     `db:"provider_invoice_id" json:"provider_invoice_id"`
	AmountCents       int64      `db:"amount_cents" json:"amount_cents"`
	Currency          string     `db:"currency" json:"currency"`
	Status            string     `db:"status" json:"status"`
	HostedInvoiceURL  string     `db:"hosted_invoice_url" json:"hosted_invoice_url"`
	PdfURL            string     `db:"pdf_url" json:"pdf_url"`
	TaxAmountCents    int64      `db:"tax_amount_cents" json:"tax_amount_cents"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	IssuedAt          *time.Time `db:"issued_at" json:"issued_at"`
	DueAt             *time.Time `db:"due_at" json:"due_at"`
}

type BillingProfile struct {
	ID           int64     `db:"id" json:"id"`
	UserID       int64     `db:"user_id" json:"user_id"`
	Country      string    `db:"country" json:"country"`
	VATID        string    `db:"vat_id" json:"vat_id"`
	CompanyName  string    `db:"company_name" json:"company_name"`
	AddressLine1 string    `db:"address_line1" json:"address_line1"`
	AddressLine2 string    `db:"address_line2" json:"address_line2"`
	City         string    `db:"city" json:"city"`
	PostalCode   string    `db:"postal_code" json:"postal_code"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type PaymentEvent struct {
	ID         int64     `db:"id" json:"id"`
	Provider   string    `db:"provider" json:"provider"`
	EventID    string    `db:"event_id" json:"event_id"`
	ReceivedAt time.Time `db:"received_at" json:"received_at"`
}

type SubscriptionWithPlan struct {
	Subscription
	PlanCode string `db:"plan_code" json:"plan_code"`
	PlanName string `db:"plan_name" json:"plan_name"`
}

type CheckoutSession struct {
	SessionID   string `json:"session_id"`
	CheckoutURL string `json:"checkout_url"`
	Provider    string `json:"provider"`
}
