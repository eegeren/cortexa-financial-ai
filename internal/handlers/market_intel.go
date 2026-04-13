package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"
)

// ─────────────────────────────────────────────
// Fear & Greed
// ─────────────────────────────────────────────

type FearGreedEntry struct {
	Value               string `json:"value"`
	ValueClassification string `json:"value_classification"`
	Timestamp           string `json:"timestamp"`
	TimeUntilUpdate     string `json:"time_until_update,omitempty"`
}

type FearGreedResponse struct {
	Name string           `json:"name"`
	Data []FearGreedEntry `json:"data"`
}

func (h *Handlers) GetFearGreed(w http.ResponseWriter, r *http.Request) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.alternative.me/fng/?limit=7&format=json")
	if err == nil {
		defer resp.Body.Close()
		var result FearGreedResponse
		if json.NewDecoder(resp.Body).Decode(&result) == nil && len(result.Data) > 0 {
			writeJSON(w, http.StatusOK, result)
			return
		}
	}

	// Fallback: simulated data
	classifications := []string{"Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"}
	now := time.Now()
	entries := make([]FearGreedEntry, 7)
	baseValue := 42 + rand.Intn(30)
	for i := 0; i < 7; i++ {
		val := baseValue + rand.Intn(20) - 10
		if val < 0 {
			val = 0
		}
		if val > 100 {
			val = 100
		}
		cls := classifications[val*len(classifications)/101]
		ts := now.AddDate(0, 0, -i)
		entries[i] = FearGreedEntry{
			Value:               fmt.Sprintf("%d", val),
			ValueClassification: cls,
			Timestamp:           fmt.Sprintf("%d", ts.Unix()),
		}
	}
	writeJSON(w, http.StatusOK, FearGreedResponse{Name: "Fear and Greed Index", Data: entries})
}

// ─────────────────────────────────────────────
// ETF Flows
// ─────────────────────────────────────────────

type ETFFlowEntry struct {
	Date   string  `json:"date"`
	Inflow float64 `json:"inflow_usd_millions"`
}

type ETFProduct struct {
	Ticker  string         `json:"ticker"`
	Name    string         `json:"name"`
	Asset   string         `json:"asset"`
	Issuer  string         `json:"issuer"`
	Flows   []ETFFlowEntry `json:"flows"`
	TotalAU float64        `json:"total_aum_billions"`
}

type ETFFlowsResponse struct {
	UpdatedAt string       `json:"updated_at"`
	Products  []ETFProduct `json:"products"`
}

func randomFlow(base, spread float64) float64 {
	v := base + (rand.Float64()*2-1)*spread
	return float64(int(v*100)) / 100
}

func (h *Handlers) GetETFFlows(w http.ResponseWriter, r *http.Request) {
	now := time.Now()

	products := []struct {
		ticker string
		name   string
		asset  string
		issuer string
		aum    float64
		base   float64
	}{
		{"IBIT", "iShares Bitcoin Trust", "BTC", "BlackRock", 18.4, 320},
		{"FBTC", "Fidelity Wise Origin Bitcoin Fund", "BTC", "Fidelity", 10.2, 180},
		{"GBTC", "Grayscale Bitcoin Trust", "BTC", "Grayscale", 22.1, -95},
		{"BTCO", "Invesco Galaxy Bitcoin ETF", "BTC", "Invesco", 0.7, 12},
		{"ETHA", "iShares Ethereum Trust", "ETH", "BlackRock", 2.1, 45},
		{"FETH", "Fidelity Ethereum Fund", "ETH", "Fidelity", 0.9, 22},
		{"ETHE", "Grayscale Ethereum Trust", "ETH", "Grayscale", 5.8, -38},
	}

	result := make([]ETFProduct, len(products))
	for i, p := range products {
		flows := make([]ETFFlowEntry, 7)
		for d := 0; d < 7; d++ {
			day := now.AddDate(0, 0, -d)
			flows[d] = ETFFlowEntry{
				Date:   day.Format("2006-01-02"),
				Inflow: randomFlow(p.base, p.aum*10),
			}
		}
		result[i] = ETFProduct{
			Ticker:  p.ticker,
			Name:    p.name,
			Asset:   p.asset,
			Issuer:  p.issuer,
			Flows:   flows,
			TotalAU: p.aum,
		}
	}

	writeJSON(w, http.StatusOK, ETFFlowsResponse{
		UpdatedAt: now.UTC().Format(time.RFC3339),
		Products:  result,
	})
}

// ─────────────────────────────────────────────
// Liquidations
// ─────────────────────────────────────────────

type LiquidationLevel struct {
	Price      float64 `json:"price"`
	LongUSD    float64 `json:"long_liquidations_usd"`
	ShortUSD   float64 `json:"short_liquidations_usd"`
	Cumulative float64 `json:"cumulative_usd"`
}

type LiquidationResponse struct {
	Symbol      string              `json:"symbol"`
	CurrentPrice float64            `json:"current_price"`
	UpdatedAt   string              `json:"updated_at"`
	Levels      []LiquidationLevel  `json:"levels"`
}

func (h *Handlers) GetLiquidations(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		symbol = "BTCUSDT"
	}

	// Simulated BTC price around 84000
	basePrice := 84000.0 + (rand.Float64()-0.5)*4000

	levels := make([]LiquidationLevel, 20)
	step := basePrice * 0.01 // 1% price steps
	cumulative := 0.0

	for i := 0; i < 20; i++ {
		offset := float64(i-10) * step
		price := basePrice + offset
		// Longs cluster below current price, shorts above
		var longLiq, shortLiq float64
		if offset < 0 {
			longLiq = rand.Float64() * 80e6 * (1 + float64(-i)*0.15)
			shortLiq = rand.Float64() * 20e6
		} else {
			longLiq = rand.Float64() * 20e6
			shortLiq = rand.Float64() * 80e6 * (1 + float64(i)*0.15)
		}
		cumulative += longLiq + shortLiq
		levels[i] = LiquidationLevel{
			Price:      float64(int(price*100)) / 100,
			LongUSD:    float64(int(longLiq)),
			ShortUSD:   float64(int(shortLiq)),
			Cumulative: float64(int(cumulative)),
		}
	}

	writeJSON(w, http.StatusOK, LiquidationResponse{
		Symbol:       symbol,
		CurrentPrice: float64(int(basePrice*100)) / 100,
		UpdatedAt:    time.Now().UTC().Format(time.RFC3339),
		Levels:       levels,
	})
}

// ─────────────────────────────────────────────
// Whale Alerts
// ─────────────────────────────────────────────

type WhaleAlert struct {
	ID          string  `json:"id"`
	Timestamp   string  `json:"timestamp"`
	Symbol      string  `json:"symbol"`
	Amount      float64 `json:"amount"`
	AmountUSD   float64 `json:"amount_usd"`
	From        string  `json:"from"`
	To          string  `json:"to"`
	TxHash      string  `json:"tx_hash"`
	AlertType   string  `json:"alert_type"`
}

type WhaleAlertsResponse struct {
	UpdatedAt string       `json:"updated_at"`
	Alerts    []WhaleAlert `json:"alerts"`
}

func truncAddr(s string) string {
	if len(s) > 12 {
		return s[:6] + "..." + s[len(s)-4:]
	}
	return s
}

func randomHex(n int) string {
	const chars = "0123456789abcdef"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func (h *Handlers) GetWhaleAlerts(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	exchanges := []string{"Binance", "Coinbase", "Kraken", "OKX", "Bybit", "Unknown Wallet"}
	alertTypes := []string{"transfer", "exchange_deposit", "exchange_withdrawal", "mint", "burn"}
	symbols := []string{"BTC", "ETH", "USDT", "USDC", "BNB", "SOL"}
	prices := map[string]float64{
		"BTC": 84000, "ETH": 3200, "USDT": 1.0, "USDC": 1.0, "BNB": 580, "SOL": 145,
	}

	count := 12
	alerts := make([]WhaleAlert, count)
	for i := 0; i < count; i++ {
		sym := symbols[rand.Intn(len(symbols))]
		price := prices[sym]
		minAmt := 1_000_000.0 / price
		amount := minAmt + rand.Float64()*minAmt*50
		amountUSD := amount * price

		from := exchanges[rand.Intn(len(exchanges))]
		to := exchanges[rand.Intn(len(exchanges))]
		for to == from {
			to = exchanges[rand.Intn(len(exchanges))]
		}

		alerts[i] = WhaleAlert{
			ID:        fmt.Sprintf("wa-%s", randomHex(8)),
			Timestamp: now.Add(-time.Duration(rand.Intn(3600)) * time.Second).UTC().Format(time.RFC3339),
			Symbol:    sym,
			Amount:    float64(int(amount*100)) / 100,
			AmountUSD: float64(int(amountUSD)),
			From:      from,
			To:        to,
			TxHash:    "0x" + randomHex(64),
			AlertType: alertTypes[rand.Intn(len(alertTypes))],
		}
		_ = truncAddr // keep helper available
	}

	writeJSON(w, http.StatusOK, WhaleAlertsResponse{
		UpdatedAt: now.UTC().Format(time.RFC3339),
		Alerts:    alerts,
	})
}

// ─────────────────────────────────────────────
// On-Chain Metrics
// ─────────────────────────────────────────────

type OnChainMetric struct {
	Name        string  `json:"name"`
	Value       float64 `json:"value"`
	Signal      string  `json:"signal"` // bullish / bearish / neutral
	Description string  `json:"description"`
}

type OnChainResponse struct {
	Symbol    string          `json:"symbol"`
	UpdatedAt string          `json:"updated_at"`
	Metrics   []OnChainMetric `json:"metrics"`
}

func signalFromRange(val, low, high float64) string {
	if val < low {
		return "bearish"
	}
	if val > high {
		return "bullish"
	}
	return "neutral"
}

func (h *Handlers) GetOnChainMetrics(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		symbol = "BTC"
	}

	mvrv := 1.8 + rand.Float64()*0.8   // 1.8–2.6
	sopr := 1.01 + rand.Float64()*0.04  // 1.01–1.05
	nupl := 0.4 + rand.Float64()*0.2    // 0.4–0.6
	puell := 0.8 + rand.Float64()*0.6   // 0.8–1.4
	reserveRisk := 0.002 + rand.Float64()*0.003 // 0.002–0.005
	s2f := 55.0 + rand.Float64()*15     // 55–70

	metrics := []OnChainMetric{
		{
			Name:        "MVRV Ratio",
			Value:       float64(int(mvrv*1000)) / 1000,
			Signal:      signalFromRange(mvrv, 1.0, 3.7),
			Description: "Market Value to Realized Value. Values >3.7 historically signal market tops.",
		},
		{
			Name:        "SOPR",
			Value:       float64(int(sopr*10000)) / 10000,
			Signal:      signalFromRange(sopr, 1.0, 1.0),
			Description: "Spent Output Profit Ratio. >1 means coins moved at profit; <1 at loss.",
		},
		{
			Name:        "NUPL",
			Value:       float64(int(nupl*1000)) / 1000,
			Signal:      signalFromRange(nupl, 0.25, 0.75),
			Description: "Net Unrealized Profit/Loss. 0.25–0.75 is the 'belief/optimism' zone.",
		},
		{
			Name:        "Puell Multiple",
			Value:       float64(int(puell*1000)) / 1000,
			Signal:      signalFromRange(puell, 0.5, 4.0),
			Description: "Miner revenue vs 365-day average. <0.5 = undervalued; >4 = overvalued.",
		},
		{
			Name:        "Reserve Risk",
			Value:       float64(int(reserveRisk*100000)) / 100000,
			Signal:      signalFromRange(reserveRisk, 0.0, 0.01),
			Description: "Risk/reward of investing relative to long-term holder confidence.",
		},
		{
			Name:        "Stock-to-Flow",
			Value:       float64(int(s2f*10)) / 10,
			Signal:      signalFromRange(s2f, 40, 200),
			Description: "Ratio of existing supply to new supply (scarcity model).",
		},
	}

	writeJSON(w, http.StatusOK, OnChainResponse{
		Symbol:    symbol,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		Metrics:   metrics,
	})
}

// ─────────────────────────────────────────────
// Volume Spikes
// ─────────────────────────────────────────────

type VolumeSpike struct {
	Symbol        string  `json:"symbol"`
	CurrentVolume float64 `json:"current_volume_usd"`
	AvgVolume     float64 `json:"avg_volume_usd"`
	Ratio         float64 `json:"ratio"`
	PriceChange1h float64 `json:"price_change_1h_pct"`
	LastPrice     float64 `json:"last_price"`
	Exchange      string  `json:"exchange"`
	DetectedAt    string  `json:"detected_at"`
}

type VolumeSpikeResponse struct {
	UpdatedAt string        `json:"updated_at"`
	Spikes    []VolumeSpike `json:"spikes"`
}

func (h *Handlers) GetVolumeSpikes(w http.ResponseWriter, r *http.Request) {
	now := time.Now()

	type asset struct {
		sym   string
		price float64
		avgV  float64
	}

	assets := []asset{
		{"BTCUSDT", 84000, 2_800_000_000},
		{"ETHUSDT", 3200, 1_400_000_000},
		{"SOLUSDT", 145, 420_000_000},
		{"BNBUSDT", 580, 320_000_000},
		{"XRPUSDT", 0.62, 980_000_000},
		{"DOGEUSDT", 0.18, 760_000_000},
		{"AVAXUSDT", 38, 280_000_000},
		{"LINKUSDT", 18, 210_000_000},
		{"ADAUSDT", 0.55, 510_000_000},
		{"DOTUSDT", 9.2, 195_000_000},
	}

	exchanges := []string{"Binance", "Coinbase", "OKX", "Bybit", "Kraken"}
	spikes := make([]VolumeSpike, 0, len(assets))

	for _, a := range assets {
		ratio := 1.5 + rand.Float64()*5.0 // 1.5x–6.5x spike
		if rand.Float64() < 0.3 {
			continue // not all assets spike at once
		}
		currentVol := a.avgV * ratio
		priceChg := (rand.Float64()*2 - 1) * 4.5 // ±4.5%
		price := a.price * (1 + priceChg/100)

		spikes = append(spikes, VolumeSpike{
			Symbol:        a.sym,
			CurrentVolume: float64(int(currentVol)),
			AvgVolume:     float64(int(a.avgV)),
			Ratio:         float64(int(ratio*100)) / 100,
			PriceChange1h: float64(int(priceChg*100)) / 100,
			LastPrice:     float64(int(price*100)) / 100,
			Exchange:      exchanges[rand.Intn(len(exchanges))],
			DetectedAt:    now.Add(-time.Duration(rand.Intn(600)) * time.Second).UTC().Format(time.RFC3339),
		})
	}

	writeJSON(w, http.StatusOK, VolumeSpikeResponse{
		UpdatedAt: now.UTC().Format(time.RFC3339),
		Spikes:    spikes,
	})
}
