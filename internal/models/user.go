package models

type User struct {
	ID       int64  `db:"id" json:"id"`
	Email    string `db:"email" json:"email"`
	Password string `db:"password_hash" json:"-"`
	Role     string `db:"role" json:"role"`
}
