@echo off
chcp 65001 >nul
title Cortexa Trade AI - Lokal Başlatıcı
color 0A

echo ╔══════════════════════════════════════════════════════════╗
echo ║          CORTEXA TRADE AI - Lokal Kurulum                ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: ─── Gerekli araçları kontrol et ────────────────────────────────────────────
set MISSING=0

python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python bulunamadı. Yükleniyor...
    winget install -e --id Python.Python.3.11 --silent
    if errorlevel 1 (
        echo [HATA] Python yüklenemedi. https://python.org adresinden manuel yükleyin.
        set MISSING=1
    ) else (
        echo [OK] Python 3.11 yüklendi.
        :: PATH'i yenile
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"
    )
) else (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do echo [OK] Python %%v mevcut.
)

go version >nul 2>&1
if errorlevel 1 (
    echo [!] Go bulunamadı. Yükleniyor...
    winget install -e --id GoLang.Go --silent
    if errorlevel 1 (
        echo [HATA] Go yüklenemedi. https://go.dev adresinden manuel yükleyin.
        set MISSING=1
    ) else (
        echo [OK] Go yüklendi.
        set "PATH=C:\Program Files\Go\bin;%PATH%"
    )
) else (
    for /f "tokens=3" %%v in ('go version 2^>^&1') do echo [OK] Go %%v mevcut.
)

:: PostgreSQL kontrolü
pg_isready >nul 2>&1
if errorlevel 1 (
    :: Servis olarak kontrol et
    sc query postgresql >nul 2>&1
    if errorlevel 1 (
        echo [!] PostgreSQL bulunamadı. Yükleniyor...
        winget install -e --id PostgreSQL.PostgreSQL.16 --silent
        if errorlevel 1 (
            echo [HATA] PostgreSQL yüklenemedi. https://postgresql.org adresinden manuel yükleyin.
            set MISSING=1
        ) else (
            echo [OK] PostgreSQL 16 yüklendi.
            set "PATH=C:\Program Files\PostgreSQL\16\bin;%PATH%"
        )
    ) else (
        echo [OK] PostgreSQL servisi mevcut.
        net start postgresql >nul 2>&1
    )
) else (
    echo [OK] PostgreSQL çalışıyor.
)

if %MISSING%==1 (
    echo.
    echo [UYARI] Bazı araçlar yüklenemedi. Lütfen yukarıdaki hataları çözün.
    echo Kurulumdan sonra bu scripti yeniden çalıştırın.
    pause
    exit /b 1
)

echo.
echo ─────────────────────────────────────────────────────────────
echo Tüm araçlar hazır. Servisler başlatılıyor...
echo ─────────────────────────────────────────────────────────────
echo.

:: ─── Veritabanı oluştur ─────────────────────────────────────────────────────
echo [1/4] Veritabanı hazırlanıyor...
psql -U postgres -c "CREATE DATABASE cta;" >nul 2>&1
echo [OK] Veritabanı hazır.
echo.

:: ─── Python bağımlılıklarını yükle ──────────────────────────────────────────
echo [2/4] Python bağımlılıkları yükleniyor...
if not exist "ai-service\venv" (
    python -m venv ai-service\venv
)
call ai-service\venv\Scripts\activate.bat
pip install -q -r ai-service\requirements.txt
echo [OK] Python bağımlılıkları hazır.
echo.

:: ─── Go bağımlılıklarını indir ──────────────────────────────────────────────
echo [3/4] Go modülleri indiriliyor...
go mod download
echo [OK] Go modülleri hazır.
echo.

:: ─── Servisleri başlat ──────────────────────────────────────────────────────
echo [4/4] Servisler başlatılıyor...
echo.

:: AI Servisi (port 8001)
echo [AI]       http://localhost:8001  başlatılıyor...
start "Cortexa AI Service" /min cmd /k "cd /d "%~dp0" && call ai-service\venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

:: 3 saniye bekle
timeout /t 3 /nobreak >nul

:: Go Backend (port 8080)
echo [Backend]  http://localhost:8080  başlatılıyor...
start "Cortexa Go API" /min cmd /k "cd /d "%~dp0" && go run ./cmd/api"

:: 3 saniye bekle
timeout /t 3 /nobreak >nul

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║  Tüm servisler başlatıldı!                               ║
echo ║                                                          ║
echo ║  AI Service  : http://localhost:8001                     ║
echo ║  Uygulama    : http://localhost:8080  (Frontend + API)   ║
echo ║                                                          ║
echo ║  Go backend frontend/dist klasörünü otomatik servis      ║
echo ║  eder – tarayıcınızda http://localhost:8080 açın.        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Servis pencerelerini kapatmak için her terminal penceresini kapatın.
pause
