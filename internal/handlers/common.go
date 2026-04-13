package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
)

var reTimeframeSuffix = regexp.MustCompile(`(?i)-\d+[mhd]w?$`)

// normalizeSymbolParam converts URL path segments like "doge-usdt-15m" → "DOGEUSDT".
func normalizeSymbolParam(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToUpper(s)
	s = reTimeframeSuffix.ReplaceAllString(s, "")
	s = regexp.MustCompile(`[^A-Z0-9]`).ReplaceAllString(s, "")
	return s
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
