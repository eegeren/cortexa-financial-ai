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

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Varsayılan olarak `http://localhost:5173` çalışan arayüz, `VITE_API_URL` ile belirlenen backend’e istek atar.

## AI Sinyal Servisi

`ai-service/signal_api.py` çoklu zaman dilimli indikatörlerden skor üretir ve `/predict` ucu üzerinden JSON döner. Backend `.env` içinde `AI_SERVICE_URL` parametresi ile FastAPI örneğine bağlanır.

## Lisans

Internal kullanım içindir.

