package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
)

type PriceService struct{ cfg config.Config }

func NewPriceService(cfg config.Config) *PriceService { return &PriceService{cfg: cfg} }

func normalizePath(path string) string {
	if path == "" {
		return "/api/v3/klines"
	}
	if strings.HasPrefix(path, "/") {
		return path
	}
	return "/" + path
}

type priceSource struct {
	base string
	path string
}

func dedupeSources(cfg config.Config) []priceSource {
	primary := priceSource{strings.TrimSuffix(cfg.BinanceBaseURL, "/"), normalizePath(cfg.BinanceKlinesPath)}
	fallback := priceSource{strings.TrimSuffix(cfg.BinanceFallbackURL, "/"), normalizePath(cfg.BinanceFallbackKlinesPath)}
	list := []priceSource{}
	seen := map[string]bool{}
	for _, src := range []priceSource{primary, fallback} {
		if src.base == "" {
			continue
		}
		key := src.base + src.path
		if seen[key] {
			continue
		}
		seen[key] = true
		list = append(list, src)
	}
	if len(list) == 0 {
		list = append(list, priceSource{"https://data-api.binance.vision", "/api/v3/klines"})
	}
	return list
}

// Binance klines
func (s *PriceService) GetOHLCV(ctx context.Context, symbol, interval string, limit int) (any, error) {
	q := url.Values{}
	q.Set("symbol", symbol)
	q.Set("interval", interval)
	q.Set("limit", fmt.Sprintf("%d", limit))

	client := &http.Client{Timeout: 10 * time.Second}
	sources := dedupeSources(s.cfg)
	errs := make([]string, 0, len(sources))

	for _, src := range sources {
		endpoint := fmt.Sprintf("%s%s?%s", src.base, src.path, q.Encode())
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		req.Header.Set("User-Agent", "cortexa-trade-ai/1.0")

		resp, err := client.Do(req)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", endpoint, err))
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			errs = append(errs, fmt.Sprintf("%s: status %d", endpoint, resp.StatusCode))
			continue
		}

		var raw [][]any
		if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
			errs = append(errs, fmt.Sprintf("%s: decode error %v", endpoint, err))
			continue
		}

		ohlcv := make([][]any, 0, len(raw))
		for _, k := range raw {
			if len(k) >= 6 {
				row := []any{k[0], k[1], k[2], k[3], k[4], k[5]}
				// Replace inf with nil to avoid frontend issues
				for i := 1; i <= 5; i++ {
					if val, ok := row[i].(float64); ok {
						if !isFinite(val) {
							row[i] = nil
						}
					}
				}
				ohlcv = append(ohlcv, row)
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

	return nil, fmt.Errorf("all price sources failed: %s", strings.Join(errs, " | "))
}

func isFinite(val float64) bool {
	return !math.IsNaN(val) && !math.IsInf(val, +1) && !math.IsInf(val, -1)
}
