package bot

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type BinanceExecutor struct {
	client     *http.Client
	service    *Service
	logger     *zap.Logger
	baseURL    string
	spotURL    string
	futuresURL string
}

type BinanceAPIError struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

func (e *BinanceAPIError) Error() string {
	return fmt.Sprintf("binance error %d: %s", e.Code, e.Msg)
}

type binanceOrderResponse struct {
	OrderID     any     `json:"orderId"`
	ClientOrder string  `json:"clientOrderId"`
	Price       string  `json:"price"`
	Status      string  `json:"status"`
	Symbol      string  `json:"symbol"`
	AvgPrice    string  `json:"avgPrice"`
	ExecutedQty string  `json:"executedQty"`
}

type binanceAccountResponse struct {
	CanTrade bool `json:"canTrade"`
	Balances []struct {
		Asset string `json:"asset"`
		Free  string `json:"free"`
	} `json:"balances"`
}

type binanceFuturesBalance struct {
	Asset            string `json:"asset"`
	Balance          string `json:"balance"`
	AvailableBalance string `json:"availableBalance"`
}

func NewBinanceExecutor(service *Service, logger *zap.Logger) *BinanceExecutor {
	if logger == nil {
		logger = zap.NewNop()
	}
	baseURL := "https://api.binance.com"
	if service != nil && strings.TrimSpace(service.cfg.BinanceBaseURL) != "" {
		baseURL = strings.TrimSpace(service.cfg.BinanceBaseURL)
	}
	return &BinanceExecutor{
		client:     &http.Client{Timeout: 12 * time.Second},
		service:    service,
		logger:     logger,
		baseURL:    baseURL,
		spotURL:    strings.TrimRight(baseURL, "/"),
		futuresURL: "https://fapi.binance.com",
	}
}

func normalizeEncryptionKey(raw string) []byte {
	trimmed := strings.TrimSpace(raw)
	if decoded, err := hex.DecodeString(trimmed); err == nil && len(decoded) == 32 {
		return decoded
	}
	if decoded, err := base64.StdEncoding.DecodeString(trimmed); err == nil && len(decoded) == 32 {
		return decoded
	}
	sum := sha256.Sum256([]byte(trimmed))
	return sum[:]
}

func encryptSecret(masterKey, plaintext string) (string, error) {
	if strings.TrimSpace(plaintext) == "" {
		return "", nil
	}
	block, err := aes.NewCipher(normalizeEncryptionKey(masterKey))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptSecret(masterKey, ciphertext string) (string, error) {
	if strings.TrimSpace(ciphertext) == "" {
		return "", nil
	}
	payload, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(normalizeEncryptionKey(masterKey))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(payload) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, encrypted := payload[:gcm.NonceSize()], payload[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func signedQuery(values url.Values, secret string) string {
	encoded := values.Encode()
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(encoded))
	signature := hex.EncodeToString(mac.Sum(nil))
	if encoded == "" {
		return "signature=" + signature
	}
	return encoded + "&signature=" + signature
}

func normalizePairSymbol(value string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(value), "/", ""))
}

func stringToFloatPtr(value string) *float64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func stringifyOrderID(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case json.Number:
		return typed.String()
	default:
		return uuid.NewString()
	}
}

func (e *BinanceExecutor) doSignedRequest(ctx context.Context, method, endpoint string, values url.Values, apiKey, apiSecret string) ([]byte, error) {
	if values == nil {
		values = url.Values{}
	}
	values.Set("timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
	var body []byte
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		query := signedQuery(values, apiSecret)
		req, err := http.NewRequestWithContext(ctx, method, endpoint+"?"+query, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("X-MBX-APIKEY", apiKey)
		resp, err := e.client.Do(req)
		if err != nil {
			lastErr = err
		} else {
			body, _ = io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			e.logger.Info("binance_request",
				zap.String("method", method),
				zap.String("endpoint", endpoint),
				zap.Int("status", resp.StatusCode),
				zap.Int("attempt", attempt+1),
			)
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return body, nil
			}
			var apiErr BinanceAPIError
			if err := json.Unmarshal(body, &apiErr); err == nil && apiErr.Code != 0 {
				if resp.StatusCode == http.StatusTooManyRequests || apiErr.Code == -1003 {
					lastErr = &apiErr
				} else {
					return nil, &apiErr
				}
			} else {
				lastErr = fmt.Errorf("binance status %d", resp.StatusCode)
			}
		}
		time.Sleep(time.Duration(1<<attempt) * 300 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("binance request failed")
	}
	return nil, lastErr
}

func (e *BinanceExecutor) TestConnection(ctx context.Context, apiKey, apiSecret string) (TestConnectionResult, error) {
	values := url.Values{}
	body, err := e.doSignedRequest(ctx, http.MethodGet, e.spotURL+"/api/v3/account", values, apiKey, apiSecret)
	if err != nil {
		return TestConnectionResult{Success: false, Error: err.Error()}, err
	}
	var account binanceAccountResponse
	if err := json.Unmarshal(body, &account); err != nil {
		return TestConnectionResult{Success: false, Error: "invalid account response"}, err
	}
	if !account.CanTrade {
		return TestConnectionResult{Success: false, Error: "trade scope missing on API key"}, fmt.Errorf("trade scope missing")
	}
	balance := "0.00"
	for _, item := range account.Balances {
		if strings.EqualFold(item.Asset, "USDT") {
			if parsed, err := strconv.ParseFloat(item.Free, 64); err == nil {
				balance = fmt.Sprintf("%.2f", parsed)
			}
			break
		}
	}
	return TestConnectionResult{Success: true, Balance: balance}, nil
}

func (e *BinanceExecutor) SpotBalance(ctx context.Context, apiKey, apiSecret string) (float64, error) {
	result, err := e.TestConnection(ctx, apiKey, apiSecret)
	if err != nil {
		return 0, err
	}
	balance, _ := strconv.ParseFloat(result.Balance, 64)
	return balance, nil
}

func (e *BinanceExecutor) FuturesBalance(ctx context.Context, apiKey, apiSecret string) (float64, error) {
	body, err := e.doSignedRequest(ctx, http.MethodGet, e.futuresURL+"/fapi/v2/balance", url.Values{}, apiKey, apiSecret)
	if err != nil {
		return 0, err
	}
	items := []binanceFuturesBalance{}
	if err := json.Unmarshal(body, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if strings.EqualFold(item.Asset, "USDT") {
			if parsed, err := strconv.ParseFloat(item.AvailableBalance, 64); err == nil {
				return parsed, nil
			}
		}
	}
	return 0, nil
}

func (e *BinanceExecutor) BalanceForTradeType(ctx context.Context, apiKey, apiSecret, tradeType string) (float64, error) {
	if strings.EqualFold(tradeType, "futures") {
		return e.FuturesBalance(ctx, apiKey, apiSecret)
	}
	return e.SpotBalance(ctx, apiKey, apiSecret)
}

func (e *BinanceExecutor) PlaceOrder(ctx context.Context, apiKey, apiSecret string, req OrderRequest) (OrderResponse, error) {
	tradeType := strings.ToLower(strings.TrimSpace(req.TradeType))
	if tradeType == "" {
		tradeType = "spot"
	}
	endpoint := e.spotURL + "/api/v3/order"
	binanceSide := "BUY"
	if strings.EqualFold(req.Side, "short") {
		binanceSide = "SELL"
	}
	if tradeType == "futures" {
		endpoint = e.futuresURL + "/fapi/v1/order"
	}
	params := url.Values{}
	params.Set("symbol", normalizePairSymbol(req.Pair))
	params.Set("side", binanceSide)
	params.Set("type", "MARKET")
	params.Set("quantity", strconv.FormatFloat(req.Quantity, 'f', 6, 64))
	params.Set("newClientOrderId", "cortexa-"+uuid.NewString())

	body, err := e.doSignedRequest(ctx, http.MethodPost, endpoint, params, apiKey, apiSecret)
	if err != nil {
		return OrderResponse{Status: "failed", Error: err.Error()}, err
	}
	var placed binanceOrderResponse
	if err := json.Unmarshal(body, &placed); err != nil {
		return OrderResponse{Status: "failed", Error: "invalid binance response"}, err
	}

	resp := OrderResponse{
		OrderID:     uuid.NewString(),
		Status:      strings.ToLower(placed.Status),
		FilledPrice: stringToFloatPtr(firstNonEmpty(placed.AvgPrice, placed.Price)),
		ExchangeID:  stringifyOrderID(placed.OrderID),
	}
	if resp.Status == "" {
		resp.Status = "filled"
	}

	stopSide := "SELL"
	closeSide := "SELL"
	if strings.EqualFold(req.Side, "short") {
		stopSide = "BUY"
		closeSide = "BUY"
	}
	if tradeType == "spot" && strings.EqualFold(req.Side, "short") {
		return OrderResponse{Status: "failed", Error: "spot trading only supports long orders"}, fmt.Errorf("spot trading only supports long orders")
	}

	if req.SLPrice > 0 {
		slParams := url.Values{}
		slParams.Set("symbol", normalizePairSymbol(req.Pair))
		slParams.Set("side", stopSide)
		slParams.Set("type", ternary(tradeType == "futures", "STOP_MARKET", "STOP_LOSS_LIMIT"))
		slParams.Set("quantity", strconv.FormatFloat(req.Quantity, 'f', 6, 64))
		slParams.Set("stopPrice", strconv.FormatFloat(req.SLPrice, 'f', 6, 64))
		if tradeType != "futures" {
			slParams.Set("price", strconv.FormatFloat(req.SLPrice, 'f', 6, 64))
			slParams.Set("timeInForce", "GTC")
		} else {
			slParams.Set("closePosition", "false")
		}
		_, _ = e.doSignedRequest(ctx, http.MethodPost, endpoint, slParams, apiKey, apiSecret)
	}
	if req.TPPrice > 0 {
		tpParams := url.Values{}
		tpParams.Set("symbol", normalizePairSymbol(req.Pair))
		tpParams.Set("side", closeSide)
		tpParams.Set("type", ternary(tradeType == "futures", "TAKE_PROFIT_MARKET", "TAKE_PROFIT_LIMIT"))
		tpParams.Set("quantity", strconv.FormatFloat(req.Quantity, 'f', 6, 64))
		tpParams.Set("stopPrice", strconv.FormatFloat(req.TPPrice, 'f', 6, 64))
		if tradeType != "futures" {
			tpParams.Set("price", strconv.FormatFloat(req.TPPrice, 'f', 6, 64))
			tpParams.Set("timeInForce", "GTC")
		} else {
			tpParams.Set("closePosition", "false")
		}
		_, _ = e.doSignedRequest(ctx, http.MethodPost, endpoint, tpParams, apiKey, apiSecret)
	}

	return resp, nil
}

func (e *BinanceExecutor) CancelOrder(ctx context.Context, apiKey, apiSecret, pair, exchangeOrderID, tradeType string) error {
	endpoint := e.spotURL + "/api/v3/order"
	if strings.EqualFold(tradeType, "futures") {
		endpoint = e.futuresURL + "/fapi/v1/order"
	}
	params := url.Values{}
	params.Set("symbol", normalizePairSymbol(pair))
	params.Set("orderId", exchangeOrderID)
	_, err := e.doSignedRequest(ctx, http.MethodDelete, endpoint, params, apiKey, apiSecret)
	return err
}

func firstNonEmpty(values ...string) string {
	for _, item := range values {
		if strings.TrimSpace(item) != "" {
			return item
		}
	}
	return ""
}

func ternary[T any](condition bool, whenTrue, whenFalse T) T {
	if condition {
		return whenTrue
	}
	return whenFalse
}
