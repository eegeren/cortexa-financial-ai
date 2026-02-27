package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/services"
)

type ctxKey string

const UserIDKey ctxKey = "uid"

func JWT(auth *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			parts := strings.Split(h, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			uid, role, err := auth.ParseToken(parts[1])
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, map[string]any{"id": uid, "role": role})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m, ok := r.Context().Value(UserIDKey).(map[string]any)
		if !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		role, _ := m["role"].(string)
		if role != "admin" && role != "premium" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
