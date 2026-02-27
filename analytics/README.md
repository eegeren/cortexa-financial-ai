# Analytics

Bu dizin, sinyal backtest ve veri bilimi çalışmalarını içerir.

## Modüller

- `data/`: tarihsel fiyat verisi indirme ve hazırlama araçları.
- `backtest/`: strateji simülasyonu ve performans metrikleri.
- `notebooks/`: keşif ve prototip çalışmaları.

## Ortam

Python 3.9+ ve mevcut `.venv` kullanılabilir. Gerekli paketler `requirements-analytics.txt` içinde listelenecek.

```bash
source ../.venv/bin/activate  # opsiyonel
pip install -r ../requirements-analytics.txt
```

## Kullanım

### Veri indirme

```bash
python -m analytics.scripts.download_binance BTCUSDT 1h 2023-01-01T00:00:00 2024-01-01T00:00:00
```

Çıktı dosyası varsayılan olarak `analytics/data/raw/` dizinine kaydedilir.

### Sinyal ve basit backtest

```python
from pathlib import Path
from analytics.backtest.strategies import generate_signals

res = generate_signals(
    Path("analytics/data/raw/btcusdt_15m_20230101_20240101.csv"),
    Path("analytics/data/raw/btcusdt_1h_20230101_20240101.csv"),
    Path("analytics/data/raw/btcusdt_4h_20230101_20240101.csv"),
    threshold=0.6,
    horizon=4,
)

print(res.pnl, res.trades, res.hit_rate)
res.data.to_csv("analytics/backtest/results/signals.csv")
```

Bu sonuçlar başlangıç niteliğindedir; komisyon, slipaj ve pozisyon yönetimi gibi unsurlar ilerleyen adımlarda eklenecektir.

### Otomatik backtest raporu

Canlı API'yi kullanarak çoklu sembol/parametre kombinasyonlarını test etmek için yeni scripti çalıştırabilirsiniz:

```bash
export CORTEXA_API_TOKEN="$(pbpaste)"  # JWT tokeninizi ekleyin
python analytics/scripts/backtest_report.py \
  --symbols BTCUSDT ETHUSDT \
  --thresholds 0.5 0.6 0.7 \
  --horizons 2 4 6
```

Varsayılan olarak çıktı `reports/` dizinine zaman damgalı bir JSON dosyası olarak kaydedilir ve konsolda özetlenir. Bu komutu cron gibi araçlarla zamanlayarak sinyal doğruluğunu düzenli aralıklarla denetleyebilirsiniz.
