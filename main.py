# AI Sinyal Servisi – Giriş Noktası
# Bu dosya ai-service/signal_api.py'yi çalıştırır.
# Lokal: uvicorn main:app --port 8001 --reload
# Docker: Dockerfile.ai kullanır (ai-service/signal_api.py doğrudan çalışır)

import sys
import os

# ai-service klasörünü Python path'e ekle
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "ai-service"))

from signal_api import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
