package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/cortexa-labs/cortexa-trade-ai-backend/internal/config"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model,omitempty"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

type ChatService struct {
	cfg     config.Config
	client  *http.Client
	timeout time.Duration
}

func NewChatService(cfg config.Config) *ChatService {
	return &ChatService{
		cfg:     cfg,
		client:  &http.Client{Timeout: 20 * time.Second},
		timeout: 25 * time.Second,
	}
}

type openAIRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
}

type openAIChoice struct {
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type openAIResponse struct {
	ID      string          `json:"id"`
	Choices []openAIChoice  `json:"choices"`
	Usage   json.RawMessage `json:"usage"`
}

type openAIError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

func (s *ChatService) Chat(ctx context.Context, req ChatRequest) (string, error) {
	if len(req.Messages) == 0 {
		return "", fmt.Errorf("messages required")
	}
	if s.cfg.OpenAIAPIKey == "" {
		return "", fmt.Errorf("openai api key not configured")
	}

	model := req.Model
	if strings.TrimSpace(model) == "" {
		model = s.cfg.OpenAIModel
	}
	if strings.TrimSpace(model) == "" {
		model = "gpt-4o-mini"
	}

	temperature := req.Temperature
	if temperature <= 0 {
		temperature = 0.7
	}
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 512
	}

	body := openAIRequest{
		Model:       model,
		Messages:    req.Messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
		Stream:      false,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimSuffix(s.cfg.OpenAIBaseURL, "/") + "/v1/chat/completions"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+s.cfg.OpenAIAPIKey)

	ctxTimeout, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	response, err := s.client.Do(request.WithContext(ctxTimeout))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var errPayload openAIError
		_ = json.NewDecoder(response.Body).Decode(&errPayload)
		message := errPayload.Error.Message
		if message == "" {
			message = fmt.Sprintf("openai error: %s", response.Status)
		}
		return "", fmt.Errorf(message)
	}

	var result openAIResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices returned")
	}
	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}
