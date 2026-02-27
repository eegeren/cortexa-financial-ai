# Cortexa Trade Frontend

React + Vite tabanlı bu arayüz, `cortexa-trade-ai-backend` API’lerini kullanarak sinyal görüntüleme, otomatik trade tetikleme ve portföy yönetimi ekranlarını sağlar.

## Başlangıç

```bash
cd frontend
cp .env.example .env # Gerekirse API adresini güncelleyin
npm install
npm run dev
```

Varsayılan olarak uygulama `http://localhost:5173` üzerinden ayağa kalkar ve `.env` dosyasındaki `VITE_API_URL` adresine istek gönderir.

## Özellikler

- JWT ile oturum açma / kayıt.
- Dashboard üzerinden portföy özetleri.
- AI sinyal sorgulama ve auto-trade tetikleme paneli.
- Manuel trade ekleme ve portföy listesi.

## Dizim

```
frontend/
  src/
    pages/        # Sayfalar
    components/   # UI bileşenleri
    services/     # API yardımcıları
    store/        # Zustand state yönetimi
    styles.css    # Tailwind giriş noktası
```

## Notlar

- Tailwind CSS ve Zustand kullanır.
- `npm run build` komutu ile statik çıktıyı üretip herhangi bir statik sunucuya dağıtabilirsiniz.

