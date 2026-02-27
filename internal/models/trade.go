package models

type Trade struct {
	ID     int64   `db:"id" json:"id"`
	UserID int64   `db:"user_id" json:"user_id"`
	Symbol string  `db:"symbol" json:"symbol"`
	Side   string  `db:"side" json:"side"`
	Qty    float64 `db:"qty" json:"qty"`
	Price  float64 `db:"price" json:"price"`
}
