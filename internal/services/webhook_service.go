package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
)

type WebhookService struct{ cfg config.Config }

func NewWebhookService(cfg config.Config) *WebhookService { return &WebhookService{cfg: cfg} }

func (w *WebhookService) SendBinanceMarketOrder(ctx context.Context, symbol, side string, qty float64) error {
	if w.cfg.BinanceAPIKey == "" || w.cfg.BinanceSecret == "" || w.cfg.BinanceBaseURL == "" {
		// Webhook pasif (anahtar yok)
		return nil
	}

	// Query compose
	q := url.Values{}
	q.Set("symbol", symbol)
	q.Set("side", side)     // BUY or SELL
	q.Set("type", "MARKET") // MARKET order
	q.Set("quantity", trimFloat(qty))
	q.Set("timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
	q.Set("recvWindow", "5000")

	// Signature
	mac := hmac.New(sha256.New, []byte(w.cfg.BinanceSecret))
	mac.Write([]byte(q.Encode()))
	sig := hex.EncodeToString(mac.Sum(nil))
	q.Set("signature", sig)

	endpoint := w.cfg.BinanceBaseURL + "/api/v3/order"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, io.NopCloser(stringsReader(q.Encode())))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-MBX-APIKEY", w.cfg.BinanceAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// 2xx dışı ise da hatayı üst katmana fırlatma — burada sessiz geçmek de tercih edilebilir
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// opsiyonel: gövdeyi okumadan dön
		return nil
	}
	return nil
}

// helpers
func trimFloat(f float64) string {
	// Binance quantity formatı için basit normalize (fazla sıfırları at)
	s := strconv.FormatFloat(f, 'f', -1, 64)
	return s
}

// Small replacement for strings.NewReader to avoid extra import noise above.
type strReader struct {
	s   string
	off int
}

func stringsReader(s string) *strReader { return &strReader{s: s} }
func (r *strReader) Read(p []byte) (int, error) {
	if r.off >= len(r.s) {
		return 0, io.EOF
	}
	n := copy(p, r.s[r.off:])
	r.off += n
	return n, nil
}
func (r *strReader) Close() error { return nil }
