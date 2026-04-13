package models

type Portfolio struct {
	UserID int64   `json:"user_id"`
	Trades []Trade `json:"trades"`
}
