# Cortexa Trade AI

Bu repo iki servisten oluşur:

1. **Go backend** – Kimlik doğrulama, portföy yönetimi, sinyal proxy ve Binance webhook entegrasyonu.
2. **React frontend** (`frontend/`) – Kullanıcı oturumu, sinyal paneli, otomatik trade tetikleme ve portföy görünümü.

## Backend

```bash
cp .env.example .env
make migrate      # Postgres tabloları
make run          # API (varsayılan :8080)
```

- Sinyal uçları Python FastAPI servisini (`AI_SERVICE_URL`) çağırır.
- Binance anahtarları girilmezse auto-trade isteği sadece veritabanına kaydedilir.
- `/api/chat` uç noktası OpenAI proxy olarak çalışır.
- `/api/billing/*` uçları ödeme sağlayıcısı (Stripe, Paddle, Lemon Squeezy, Iyzico) ile entegredir; webhook doğrulaması ve abonelik durumu burada yönetilir.

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Varsayılan olarak `http://localhost:5173` çalışan arayüz, `VITE_API_URL` ile belirlenen backend’e istek atar.

- `/assistant` rotası GPT tarzı sohbeti sunar (yalnızca yetkili + aktif aboneliği olan kullanıcılar erişebilir).
- `/pricing` kullanıcıya plan kartlarını gösterir ve checkout akışını tetikler.
- `/billing` müşteri portalı bağlantısı, fatura listesi ve fatura profili güncellemesini içerir.

## Ortak Ortam Değişkenleri

Backend `.env` dosyasında bulunması gereken temel anahtarlar:

- `AI_SERVICE_URL` – FastAPI sinyal servisi
- `OPENAI_API_KEY` – sohbet proxy’si için API anahtarı
- `OPENAI_BASE_URL` (opsiyonel, default `https://api.openai.com`)
- `OPENAI_MODEL` (opsiyonel, default `gpt-4o-mini`)
- `PAYMENT_PROVIDER` – `stripe`, `paddle`, `lemonsqueezy`, `iyzico`
- `OWNER_EMAIL` veya `OWNER_EMAILS` – Yönetici/premium olarak otomatik işaretlenecek e-posta(lar)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `PADDLE_API_KEY`, `PADDLE_ENV`, `PADDLE_WEBHOOK_SECRET`
- `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`
- `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_WEBHOOK_SECRET`
- `TRIAL_DAYS` (varsayılan 7)
- `PREMIUM_DISABLED` – varsayılanı `true`; `false` yaptığında premium erişim kontrolleri yeniden devreye girer

Frontend `.env` örneği:

- `VITE_API_URL` veya `NEXT_PUBLIC_API_URL` – API tabanı (örn. `http://localhost:8080`)

## Abonelik Akışı

1. Yeni kullanıcı kaydı backend tarafından otomatik olarak 7 günlük deneme aboneliği başlatır.
2. `/pricing` üzerinden plan seçilip `/api/billing/checkout` ile sağlayıcıya yönlendirilir.
3. Sağlayıcı webhook’u (`/api/webhooks/payment`) abonelik durumunu veritabanında günceller ve faturaları kaydeder.
4. `/assistant` ve gelişmiş dashboard bileşenleri yalnızca `subscriptions.status` `trialing` (süresi bitmemiş) veya `active` olduğunda kullanılabilir.
5. `/billing` sayfası müşteri portalını açar, faturaları listeler ve fatura profilini günceller.

## AI Sinyal Servisi

`ai-service/signal_api.py` çoklu zaman dilimli indikatörlerden skor üretir ve `/predict` ucu üzerinden JSON döner. Backend `.env` içinde `AI_SERVICE_URL` parametresi ile FastAPI örneğine bağlanır.

## Lisans

Internal kullanım içindir.
