package models

type User struct {
	ID           int64   `db:"id" json:"id"`
	Email        string  `db:"email" json:"email"`
	Password     string  `db:"password_hash" json:"-"`
	Role         string  `db:"role" json:"role"`
	FirstName    string  `db:"first_name" json:"first_name"`
	LastName     string  `db:"last_name" json:"last_name"`
	Phone        *string `db:"phone" json:"phone,omitempty"`
	KVKKAccepted bool    `db:"kvkk_accepted" json:"kvkk_accepted"`
}
