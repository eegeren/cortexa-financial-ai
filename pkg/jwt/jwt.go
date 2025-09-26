package jwt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

func Sign(claims map[string]any, secret string) (string, error) {
	h := map[string]string{"alg": "HS256", "typ": "JWT"}
	hb, _ := json.Marshal(h)
	cb, _ := json.Marshal(claims)

	head := base64.RawURLEncoding.EncodeToString(hb)
	body := base64.RawURLEncoding.EncodeToString(cb)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(head + "." + body))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return head + "." + body + "." + sig, nil
}

func Parse(token, secret string) (map[string]any, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed jwt")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if expSig != parts[2] {
		return nil, errors.New("bad signature")
	}

	b, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	var claims map[string]any
	if err := json.Unmarshal(b, &claims); err != nil {
		return nil, err
	}
	return claims, nil
}
