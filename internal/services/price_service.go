package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
)

type PriceService struct{ cfg config.Config }

func NewPriceService(cfg config.Config) *PriceService { return &PriceService{cfg: cfg} }

// Binance klines
func (s *PriceService) GetOHLCV(ctx context.Context, symbol, interval string, limit int) (any, error) {
	q := url.Values{}
	q.Set("symbol", symbol)
	q.Set("interval", interval)
	q.Set("limit", fmt.Sprintf("%d", limit))

	endpoint := "https://api.binance.com/api/v3/klines?" + q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", "cortexa-trade-ai/1.0")
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("binance status %d", resp.StatusCode)
	}

	var raw [][]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	ohlcv := make([][]any, 0, len(raw))
	for _, k := range raw {
		if len(k) >= 6 {
			ohlcv = append(ohlcv, []any{k[0], k[1], k[2], k[3], k[4], k[5]})
		}
	}

	return map[string]any{
		"symbol":    symbol,
		"interval":  interval,
		"limit":     limit,
		"fetchedAt": time.Now().UTC().Format(time.RFC3339),
		"ohlcv":     ohlcv,
	}, nil
}
