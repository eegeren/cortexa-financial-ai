from __future__ import annotations

import math


def json_sanitize(x):
    if isinstance(x, dict):
        return {k: json_sanitize(v) for k, v in x.items()}
    if isinstance(x, list):
        return [json_sanitize(v) for v in x]
    if isinstance(x, bool):
        return x
    if isinstance(x, (int,)):
        return x
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    try:
        import numpy as np
        if isinstance(x, (np.floating,)):
            xf = float(x)
            return xf if math.isfinite(xf) else None
        if isinstance(x, (np.integer,)):
            return int(x)
        if isinstance(x, (np.bool_,)):
            return bool(x)
    except Exception:
        pass
    return x


def parse_float_list(value: str) -> list[float]:
    try:
        return [float(v) for v in value.split(",") if v.strip()]
    except Exception as exc:
        raise HTTPException(400, "invalid float list") from exc


def parse_int_list(value: str) -> list[int]:
    try:
        return [int(v) for v in value.split(",") if v.strip()]
    except Exception as exc:
        raise HTTPException(400, "invalid int list") from exc



# --- symbol list parser ---
def parse_symbol_list(value: str) -> list[str]:
    try:
        items = [v.strip().upper() for v in value.split(",") if v.strip()]
        # basic validation: Binance symbols are alnum and usually end with USDT/BUSD/FDUSD etc.
        return [s for s in items if s.isalnum() and 4 <= len(s) <= 20]
    except Exception as exc:
        raise HTTPException(400, "invalid symbols list") from exc

# --- curated symbol universe for dropdown /symbols endpoint ---
SUPPORTED_SYMBOLS = [
    # Mega-cap
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "USDTTRY",
    # Large-cap
    "ADAUSDT", "DOGEUSDT", "TRXUSDT", "MATICUSDT", "TONUSDT", "LINKUSDT",
    "DOTUSDT", "LTCUSDT", "AVAXUSDT", "ATOMUSDT", "NEARUSDT", "APTUSDT",
    "OPUSDT", "ARBUSDT", "SUIUSDT", "INJUSDT", "AAVEUSDT", "FTMUSDT",
    # Trendy/meme
    "SHIBUSDT", "PEPEUSDT", "WIFUSDT",
    # Infra/L2
    "SEIUSDT", "TIAUSDT", "PYTHUSDT", "JTOUSDT", "JUPUSDT",
    # Oracles/defi
    "CRVUSDT", "SNXUSDT", "UNIUSDT", "CAKEUSDT",
]

import os
import time
from typing import Iterable, Tuple, Optional, Dict, Any

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from requests.adapters import HTTPAdapter
try:
    from urllib3.util.retry import Retry  # urllib3 v2
except Exception:  # pragma: no cover
    from requests.packages.urllib3.util.retry import Retry  # type: ignore (older fallback)
import pandas as pd
import numpy as np
import ta
import logging
import traceback
from ta.momentum import StochRSIIndicator

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_ORIGIN", "https://www.cortexaai.net"),
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def _unhandled_error(request: Request, exc: Exception):
    # Always log full stack for diagnostics
    logger.error("unhandled: %s", exc, exc_info=True)
    path = ""
    try:
        path = request.url.path or ""
    except Exception:
        path = ""
    # For UI-critical endpoints, degrade gracefully with HTTP 200 so the page doesn't show a hard 500 banner.
    soft_paths = (
        "/signals",
        "/predict",
        "/optimize",
        "/market",
        "/debug/predict",
    )
    if any(path.startswith(p) for p in soft_paths):
        return JSONResponse(status_code=200, content={"ok": False, "error": "ai-service-internal", "path": path})
    # Otherwise surface as 500
    return JSONResponse(status_code=500, content={"ok": False, "error": "ai-service-internal"})

# --- basic logger setup ---
logger = logging.getLogger("ai-service")
if not logger.handlers:
    handler = logging.StreamHandler()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler.setFormatter(fmt)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- resilient HTTP session with retries/backoff ---
_SESSION = requests.Session()
_retry = Retry(
    total=3,
    connect=3,
    read=3,
    backoff_factor=0.4,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=("GET",),
    raise_on_status=False,
)
_SESSION.headers.update({
    "User-Agent": "cortexa-ai-service/1.0 (+https://www.cortexaai.net)",
    "Accept": "application/json",
})

_SESSION.mount("https://", HTTPAdapter(max_retries=_retry))
_SESSION.mount("http://", HTTPAdapter(max_retries=_retry))


# --- lightweight 24h ticker fetch (Binance) ---
_BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr"


def fetch_24h_tickers(symbols: Optional[list[str]] = None, top_n: Optional[int] = None) -> list[dict]:
    """Fetch 24h ticker stats. If `symbols` is None, fetches all and optionally returns top_n by quoteVolume.
    Returns a list of dicts with at least: symbol, lastPrice, priceChangePercent, volume, quoteVolume, highPrice, lowPrice.
    """
    try:
        if symbols:
            out = []
            for sym in symbols:
                resp = _SESSION.get(_BINANCE_TICKER_URL, params={"symbol": sym}, timeout=8)
                if resp.status_code == 200:
                    out.append(resp.json())
                else:
                    logger.warning("24h ticker failed for %s: %s %s", sym, resp.status_code, resp.text[:120])
            return out
        # else: fetch all then optionally trim
        resp = _SESSION.get(_BINANCE_TICKER_URL, timeout=12)
        if resp.status_code != 200:
            raise HTTPException(502, f"ticker list failed: {resp.status_code}")
        data = resp.json()
        if not isinstance(data, list):
            raise HTTPException(502, "unexpected ticker payload")
        if top_n and top_n > 0:
            # sort by quoteVolume desc (as float)
            def _qv(d):
                try:
                    return float(d.get("quoteVolume", 0))
                except Exception:
                    return 0.0
            data.sort(key=_qv, reverse=True)
            data = data[:top_n]
        return data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("fetch_24h_tickers error: %s", exc)
        raise HTTPException(502, "failed to fetch 24h tickers")


# Lightweight root and health endpoints
@app.get("/")
def root():
    return {"ok": True, "service": "ai-service"}

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

# --- symbols endpoint for dropdown ---
@app.get("/symbols")
def get_symbols(top_n: int = 0, only_usdt: bool = True):
    """Return a list of tradable symbols for the UI dropdown.
    - If top_n>0, we try to augment the curated list with the top_n highest quoteVolume USDT pairs from Binance 24h tickers.
    - `only_usdt` limits the dynamic suggestions to symbols ending with USDT.
    The endpoint never errors with 5xx; it returns {ok: False} on soft failures to keep the UI clean.
    """
    try:
        symbols = list(dict.fromkeys(SUPPORTED_SYMBOLS))  # preserve order, unique
        if top_n and top_n > 0:
            try:
                tickers = fetch_24h_tickers(None, top_n=top_n)
                for t in tickers:
                    sym = str(t.get("symbol", "")).upper()
                    if only_usdt and not sym.endswith("USDT"):
                        continue
                    symbols.append(sym)
                # de-dup while preserving order
                symbols = list(dict.fromkeys(symbols))
            except Exception:
                pass  # ignore dynamic enrichment issues
        return {"ok": True, "symbols": symbols}
    except Exception as exc:
        logger.warning("/symbols failed: %s", exc)
        return JSONResponse(status_code=200, content={"ok": False, "symbols": list(dict.fromkeys(SUPPORTED_SYMBOLS))})

def _normalize_path(path: str) -> str:
    if not path.startswith('/'):
        return f"/{path}"
    return path

def _build_sources() -> Iterable[Tuple[str, str]]:
    primary_base = os.getenv("BINANCE_BASE_URL", "https://api.binance.com").rstrip('/')
    primary_path = _normalize_path(os.getenv("BINANCE_KLINES_PATH", "/api/v3/klines"))

    fallback_base = os.getenv("BINANCE_FALLBACK_URL", "https://data-api.binance.vision").rstrip('/')
    fallback_path = _normalize_path(os.getenv("BINANCE_FALLBACK_KLINES_PATH", "/api/v3/klines"))

    # Remove duplicates while preserving order
    seen = set()
    for base, path in ((primary_base, primary_path), (fallback_base, fallback_path)):
        if not base:
            continue
        key = (base, path)
        if key in seen:
            continue
        seen.add(key)
        yield key

DATA_SOURCES = tuple(_build_sources()) or (("https://data-api.binance.vision", "/api/v3/klines"),)

# --- lightweight in-memory cache for OHLCV to reduce provider load/flakiness ---
_OHLCV_CACHE: Dict[tuple[str,str,int], tuple[float, pd.DataFrame]] = {}
_OHLCV_TTL_SEC = int(os.getenv("OHLCV_TTL_SEC", "20"))  # default 20s

# --- lightweight in-memory cache for computed signals to avoid timeouts on flakey network ---
_SIG_CACHE: Dict[str, tuple[float, dict]] = {}
_SIG_TTL_SEC = int(os.getenv("SIG_TTL_SEC", "60"))  # serve last good result up to 60s

def _sig_cache_get(symbol: str) -> Optional[dict]:
    key = symbol.upper()
    rec = _SIG_CACHE.get(key)
    if not rec:
        return None
    ts, data = rec
    if (time.time() - ts) <= _SIG_TTL_SEC and isinstance(data, dict):
        return data.copy()
    return None

def _sig_cache_put(symbol: str, data: dict) -> None:
    _SIG_CACHE[symbol.upper()] = (time.time(), data.copy())

def _cache_get(symbol: str, interval: str, limit: int) -> Optional[pd.DataFrame]:
    key = (symbol.upper(), interval, int(limit))
    rec = _OHLCV_CACHE.get(key)
    if not rec:
        return None
    ts, df = rec
    if (time.time() - ts) <= _OHLCV_TTL_SEC and isinstance(df, pd.DataFrame) and not df.empty:
        return df
    return None

def _cache_put(symbol: str, interval: str, limit: int, df: pd.DataFrame) -> None:
    key = (symbol.upper(), interval, int(limit))
    _OHLCV_CACHE[key] = (time.time(), df.copy())

def safe_num(x, ndigits=None):
    try:
        v = float(x)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, ndigits) if ndigits is not None else v

def _request_klines(base: str, path: str, *, symbol: str, interval: str, limit: int) -> requests.Response:
    url = f"{base}{path}?symbol={symbol}&interval={interval}&limit={limit}"
    return _SESSION.get(url, timeout=15)


def fetch_ohlcv(symbol="BTCUSDT", interval="15m", limit=300):
    errors = []
    cached = _cache_get(symbol, interval, limit)
    if cached is not None:
        return cached
    for base, path in DATA_SOURCES:
        for attempt in range(3):
            try:
                resp = _request_klines(base, path, symbol=symbol, interval=interval, limit=limit)
            except requests.RequestException as exc:
                errors.append(f"{base}{path}: request failed ({exc}) [try {attempt+1}/3]")
                time.sleep(0.2 * (2 ** attempt))
                continue

            if resp.status_code != 200:
                errors.append(f"{base}{path}: status {resp.status_code} {resp.text[:120]} [try {attempt+1}/3]")
                time.sleep(0.2 * (2 ** attempt))
                continue

            try:
                data = resp.json()
            except ValueError as exc:
                errors.append(f"{base}{path}: invalid json ({exc}) [try {attempt+1}/3]")
                time.sleep(0.2 * (2 ** attempt))
                continue

            if not data:
                errors.append(f"{base}{path}: empty klines [try {attempt+1}/3]")
                time.sleep(0.2 * (2 ** attempt))
                continue

            cols = ["time","open","high","low","close","volume","ct","qv","n","tb","tq","ig"]
            df = pd.DataFrame(data, columns=cols)
            for col in ["open","high","low","close","volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df.replace([np.inf, -np.inf], np.nan, inplace=True)
            df["symbol"] = symbol

            df = df.dropna(subset=["open","high","low","close"]).copy()
            if len(df) < 50:
                errors.append(f"{base}{path}: insufficient rows ({len(df)}) [try {attempt+1}/3]")
                time.sleep(0.2 * (2 ** attempt))
                continue

            _cache_put(symbol, interval, limit, df)
            return df

    raise HTTPException(502, "all data providers failed: " + " | ".join(errors))
# --- optimizer suggestion cache (to stabilize hit-rate near target) ---
_OPT_CACHE: Dict[str, tuple[float, dict]] = {}
_OPT_TTL_SEC = int(os.getenv("OPT_TTL_SEC", "300"))  # 5 minutes

def _get_optimizer_suggestion(symbol: str) -> Optional[dict]:
    key = symbol.upper()
    now = time.time()
    rec = _OPT_CACHE.get(key)
    if rec and (now - rec[0]) <= _OPT_TTL_SEC:
        return rec[1]
    try:
        ths = [0.4, 0.5, 0.6, 0.7, 0.8]
        hzs = [2, 4, 6]
        best = optimize_params(
            key, thresholds=ths, horizons=hzs, limit=300,
            commission_bps=4.0, slippage_bps=1.0, position_size=1.0,
            target_hit=0.64, min_trades=20,
        )
        _OPT_CACHE[key] = (now, best)
        return best
    except Exception as exc:
        logger.warning("optimizer failed for %s: %s", key, exc)
        return None

 # --- custom utility: Choppiness Index (not available in ta) ---
def choppiness_index(high: pd.Series, low: pd.Series, close: pd.Series, window: int = 14) -> pd.Series:
    """Choppiness Index: high values => choppy (range-bound); low => trending.
    Returns a pandas Series aligned to `close` index.
    """
    # True Range components
    prev_close = close.shift(1)
    tr1 = (high - low).abs()
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    tr_sum = tr.rolling(window).sum()
    hh = high.rolling(window).max()
    ll = low.rolling(window).min()
    denom = (hh - ll).replace(0, np.nan)
    ci = 100 * np.log10(tr_sum / denom) / np.log10(window)
    return ci

def add_indicators(df: pd.DataFrame):
    """Tek timeframe indikatörleri (EMA, MACD, RSI, ADX, BB, ATR)."""
    df = df.copy()
    df["ema_fast"] = ta.trend.EMAIndicator(df["close"], window=12).ema_indicator()
    df["ema_slow"] = ta.trend.EMAIndicator(df["close"], window=26).ema_indicator()
    macd = ta.trend.MACD(df["close"], window_fast=12, window_slow=26, window_sign=9)
    df["macd"], df["macd_signal"], df["macd_hist"] = macd.macd(), macd.macd_signal(), macd.macd_diff()
    df["rsi"] = ta.momentum.RSIIndicator(df["close"], window=14).rsi()
    adx = ta.trend.ADXIndicator(df["high"], df["low"], df["close"], window=14)
    df["adx"] = adx.adx()
    bb = ta.volatility.BollingerBands(df["close"], window=20, window_dev=2)
    df["bb_high"], df["bb_low"], df["bb_mid"] = bb.bollinger_hband(), bb.bollinger_lband(), bb.bollinger_mavg()
    df.loc[df["bb_mid"] == 0, "bb_mid"] = np.nan
    atr = ta.volatility.AverageTrueRange(df["high"], df["low"], df["close"], window=14)
    df["atr"] = atr.average_true_range()
    # ATR yüzdesi (fiyat göreli volatilite)
    df["atr_pct"] = (df["atr"] / df["close"]).clip(lower=0)

    # === Additional features for higher signal quality ===
    # EMA slopes (trend velocity)
    df["ema_fast_slope"] = df["ema_fast"].diff()
    df["ema_slow_slope"] = df["ema_slow"].diff()

    # Bollinger Band width (relative)
    with np.errstate(divide='ignore', invalid='ignore'):
        df["bb_width"] = (df["bb_high"] - df["bb_low"]) / df["bb_mid"]
        df["bb_width"] = df["bb_width"].replace([np.inf, -np.inf], np.nan)

    # Keltner Channel for squeeze detection
    try:
        kc = ta.volatility.KeltnerChannel(df["high"], df["low"], df["close"], window=20, original_version=False)
        df["kc_high"], df["kc_low"] = kc.keltner_channel_hband(), kc.keltner_channel_lband()
        # "Squeeze on" when Bollinger is inside Keltner (avoid trading until expansion)
        df["squeeze_on"] = (df["bb_high"] < df["kc_high"]) & (df["bb_low"] > df["kc_low"]) 
    except Exception:
        # If Keltner can't be computed for any reason, default to no-squeeze
        df["kc_high"], df["kc_low"], df["squeeze_on"] = np.nan, np.nan, False

    # Distance from mean (BB mid) in ATR units to avoid mean-reversion chop
    with np.errstate(divide='ignore', invalid='ignore'):
        atr_safe = df["atr"].replace(0, np.nan)
        df["dist_from_mid_atr"] = np.abs(df["close"] - df["bb_mid"]) / atr_safe
        df["dist_from_mid_atr"] = df["dist_from_mid_atr"].replace([np.inf, -np.inf], np.nan)

    # === Volume-based confirmations ===
    try:
        df["mfi"] = ta.volume.MFIIndicator(
            high=df["high"], low=df["low"], close=df["close"], volume=df["volume"], window=14
        ).money_flow_index()
    except Exception:
        df["mfi"] = np.nan
    try:
        df["obv"] = ta.volume.OnBalanceVolumeIndicator(
            close=df["close"], volume=df["volume"]
        ).on_balance_volume()
    except Exception:
        df["obv"] = np.nan
    try:
        df["cmf"] = ta.volume.ChaikinMoneyFlowIndicator(
            high=df["high"], low=df["low"], close=df["close"], volume=df["volume"], window=20
        ).chaikin_money_flow()
    except Exception:
        df["cmf"] = np.nan

    # === Stochastic RSI (timing) ===
    try:
        stoch_rsi = StochRSIIndicator(close=df["close"], window=14, smooth1=3, smooth2=3)
        df["stoch_rsi"] = stoch_rsi.stochrsi()
        df["stoch_rsi_k"] = stoch_rsi.stochrsi_k()
        df["stoch_rsi_d"] = stoch_rsi.stochrsi_d()
    except Exception:
        df["stoch_rsi"], df["stoch_rsi_k"], df["stoch_rsi_d"] = np.nan, np.nan, np.nan

    # === VWAP (fair price) ===
    try:
        typ = (df["high"] + df["low"] + df["close"]) / 3.0
        vol = df["volume"].replace(0, np.nan)
        df["vwap"] = (typ * vol).cumsum() / vol.cumsum()
        df["above_vwap"] = (df["close"] > df["vwap"]).astype(int)
    except Exception:
        df["vwap"], df["above_vwap"] = np.nan, 0

    # === Donchian Channel (breakout) ===
    try:
        dc = ta.volatility.DonchianChannel(high=df["high"], low=df["low"], close=df["close"], window=20)
        df["donchian_h"] = dc.donchian_channel_hband()
        df["donchian_l"] = dc.donchian_channel_lband()
        df["donchian_mid"] = dc.donchian_channel_mband()
        df["donchian_break_up"] = (df["close"] > df["donchian_h"]).astype(int)
        df["donchian_break_dn"] = (df["close"] < df["donchian_l"]).astype(int)
    except Exception:
        df["donchian_h"], df["donchian_l"], df["donchian_mid"] = np.nan, np.nan, np.nan
        df["donchian_break_up"], df["donchian_break_dn"] = 0, 0

    # === Choppiness Index (range vs trend) ===
    try:
        df["chop"] = choppiness_index(df["high"], df["low"], df["close"], window=14)
    except Exception:
        df["chop"] = np.nan

    # === Secondary features for finer decisions ===
    try:
        df["obv_slope"] = df["obv"].diff(5)
    except Exception:
        df["obv_slope"] = np.nan
    try:
        with np.errstate(divide='ignore', invalid='ignore'):
            atr_safe2 = df["atr"].replace(0, np.nan)
            df["vwap_dev_atr"] = (df["close"] - df["vwap"]) / atr_safe2
            df["vwap_dev_atr"] = df["vwap_dev_atr"].replace([np.inf, -np.inf], np.nan)
    except Exception:
        df["vwap_dev_atr"] = np.nan

    return df


def prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["open_time"] = pd.to_datetime(result["time"], unit="ms")
    for col in ["open", "high", "low", "close", "volume"]:
        result[col] = pd.to_numeric(result[col], errors="coerce")
    result = result.set_index("open_time").sort_index()
    return add_indicators(result)


# --- indicator snapshot helper ---
def last_indicators_snapshot(symbol: str) -> dict:
    """Return a compact indicator snapshot for a symbol from 15m timeframe.
    Includes price, atr_pct, adx, rsi, vwap bias, and optional side/score via compute_signal.
    """
    try:
        df = prepare_frame(fetch_ohlcv(symbol, "15m", 200))
        if df.empty:
            raise HTTPException(503, "no data")
        row = df.iloc[-1]
        snap = {
            "price": safe_num(row.get("close"), 4),
            "atr_pct": safe_num(row.get("atr_pct"), 5),
            "adx": safe_num(row.get("adx"), 2),
            "rsi": safe_num(row.get("rsi"), 2),
            "above_vwap": bool(row.get("above_vwap", 0)),
            "chop": safe_num(row.get("chop"), 2),
        }
        try:
            sig = compute_signal(symbol)
            snap.update({
                "side": sig.get("side"),
                "score": sig.get("score"),
            })
        except Exception:
            # non-fatal: if compute_signal fails, return snapshot only
            pass
        return json_sanitize(snap)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("last_indicators_snapshot failed for %s: %s", symbol, exc)
        raise HTTPException(503, "indicator snapshot failed")


def generate_signal_history(symbol: str, limit: int = 400) -> pd.DataFrame:
    base = prepare_frame(fetch_ohlcv(symbol, "15m", limit))
    h1 = prepare_frame(fetch_ohlcv(symbol, "1h", max(200, limit // 4 + 10)))
    h4 = prepare_frame(fetch_ohlcv(symbol, "4h", max(100, limit // 16 + 10)))

    h1 = h1.reindex(base.index, method="ffill")
    h4 = h4.reindex(base.index, method="ffill")

    sides: list[str] = []
    scores: list[float] = []
    for ts, row in base.iterrows():
        side, score = compute_signal_row(row, h1.loc[ts], h4.loc[ts])
        sides.append(side)
        scores.append(score)

    signals = base[["close", "atr", "rsi", "ema_fast", "ema_slow", "atr_pct", "adx"]].copy()
    signals["side"] = sides
    signals["score"] = scores
    return signals


def mtf_context(symbol: str):
    """15m ana, 1h ve 4h teyit (trend + momentum)."""
    base = add_indicators(fetch_ohlcv(symbol, "15m", 300))
    h1   = add_indicators(fetch_ohlcv(symbol, "1h",  300))
    h4   = add_indicators(fetch_ohlcv(symbol, "4h",  300))
    logger.info("mtf lengths: base=%s h1=%s h4=%s", len(base), len(h1), len(h4))
    for frame, name in ((base, "15m"), (h1, "1h"), (h4, "4h")):
        if len(frame) < 50:
            raise HTTPException(503, f"not enough data for indicators on {name}")
    return base, h1, h4

def regime_filters(row):
    """Rejim/gürültü filtresi: ADX ve ATR%."""
    adx_val = safe_num(row.get("adx"))
    atrp = safe_num(row.get("atr_pct"))
    bbw = safe_num(row.get("bb_width"))
    squeeze = row.get("squeeze_on", False)
    dist_mid = safe_num(row.get("dist_from_mid_atr"))

    # Trend/volatility gates
    adx_ok = adx_val is not None and adx_val >= 12

    # Volatility acceptable window (avoid too quiet and too wild)
    vol_ok = (atrp is not None and 0.0005 <= atrp <= 0.04)

    # Avoid trades during Bollinger squeeze; wait for expansion
    if squeeze is True:
        vol_ok = False

    # Require minimum distance from mean to reduce whipsaws near BB mid
    if dist_mid is None or dist_mid < 0.15:
        vol_ok = False

    # Additional sanity on BB width (avoid extreme compression/expansion)
    if bbw is not None:
        if bbw < 0.01 or bbw > 0.25:
            vol_ok = False

    # Volume flow gate (weak flow => avoid new trades)
    mfi = safe_num(row.get("mfi"))
    cmf = safe_num(row.get("cmf"))
    if mfi is not None and cmf is not None:
        if (mfi < 35 and cmf < 0):
            vol_ok = False

    # Choppiness gate (too choppy => avoid)
    chop = safe_num(row.get("chop"))
    if chop is not None and chop > 61:
        vol_ok = False

    return bool(adx_ok), bool(vol_ok)

def directional_vote(row):
    """Yön sinyali: EMA, MACD, RSI, BB pozisyonu—basit oy sistemi."""
    votes = 0
    # EMA composite (cross + slopes), capped to [-1, 1]
    ema_component = 0.0
    if safe_num(row.get("ema_fast")) is not None and safe_num(row.get("ema_slow")) is not None:
        ema_component += 0.6 if row["ema_fast"] > row["ema_slow"] else -0.6
    if safe_num(row.get("ema_fast_slope")) is not None:
        ema_component += 0.2 if row["ema_fast_slope"] > 0 else -0.2
    if safe_num(row.get("ema_slow_slope")) is not None:
        ema_component += 0.2 if row["ema_slow_slope"] > 0 else -0.2
    # hard cap
    if ema_component > 1.0:
        ema_component = 1.0
    elif ema_component < -1.0:
        ema_component = -1.0
    votes += ema_component
    # MACD histogram
    if safe_num(row.get("macd_hist")) is not None:
        votes += 1 if row["macd_hist"] > 0 else -1
    # RSI with wider neutrality band (reduce chop)
    rsi_val = safe_num(row.get("rsi"))
    if rsi_val is not None:
        if rsi_val >= 55:
            votes += 0.5
        elif rsi_val <= 45:
            votes -= 0.5
        else:
            votes += 0.0  # neutral zone
    # Bollinger lokasyonu (orta üzeri hafif pozitif)
    if safe_num(row.get("bb_mid")) and safe_num(row.get("close")):
        votes += 0.5 if row["close"] > row["bb_mid"] else -0.5
    # StochRSI timing contribution
    st_k = safe_num(row.get("stoch_rsi_k"))
    st_d = safe_num(row.get("stoch_rsi_d"))
    if st_k is not None and st_d is not None:
        if st_k > 0.8 and st_d > 0.8:
            votes -= 0.5  # overbought
        elif st_k < 0.2 and st_d < 0.2:
            votes += 0.5  # oversold

    # VWAP bias (light weight)
    if safe_num(row.get("vwap")) is not None and safe_num(row.get("close")) is not None:
        votes += 0.25 if row["close"] > row["vwap"] else -0.25

    # Donchian breakout confirmation (align with break direction)
    b_up = row.get("donchian_break_up", 0)
    b_dn = row.get("donchian_break_dn", 0)
    if b_up == 1:
        votes += 0.25
    elif b_dn == 1:
        votes -= 0.25

    # OBV slope (5-bar) micro-weight
    obv_sl = safe_num(row.get("obv_slope"))
    if obv_sl is not None:
        if obv_sl > 0:
            votes += 0.2
        elif obv_sl < 0:
            votes -= 0.2

    # VWAP deviation in ATR units: extreme stretch tends to mean-revert
    dev_atr = safe_num(row.get("vwap_dev_atr"))
    if dev_atr is not None:
        if dev_atr > 1.5:
            votes -= 0.25
        elif dev_atr < -1.5:
            votes += 0.25

    return votes  # ~ [-3, +3] aralığı


def compute_signal_row(base_row, h1_row, h4_row):
    adx_ok, vol_ok = regime_filters(base_row)
    v_base = directional_vote(base_row)
    v_h1 = directional_vote(h1_row)
    v_h4 = directional_vote(h4_row)

    # HTF bias: if 1h and 4h both clearly positive/negative, be less sensitive to minor counter signals on 15m
    bias_long = (v_h1 >= 0.5 and v_h4 >= 0.5)
    bias_short = (v_h1 <= -0.5 and v_h4 <= -0.5)

    side = "HOLD"
    if v_base > 0 and (v_h1 >= (-0.25 if bias_long else -0.1)) and (v_h4 >= (-0.25 if bias_long else -0.1)) and adx_ok and vol_ok:
        side = "BUY"
    elif v_base < 0 and (v_h1 <= (0.25 if bias_short else 0.1)) and (v_h4 <= (0.25 if bias_short else 0.1)) and adx_ok and vol_ok:
        side = "SELL"

    score = score_from_components(v_base, v_h1, v_h4, adx_ok, vol_ok)

    # Skor bazlı ikinci değerlendirme: güçlü skorlar yön versin
    if side == "HOLD":
        if score >= 0.6:
            side = "BUY"
        elif score <= 0.4:
            side = "SELL"
    return side, score

def score_from_components(votes_base, votes_h1, votes_h4, adx_ok, vol_ok):
    """Skor: MTF hizalama + rejim filtresi + normalize."""
    align = 0
    if votes_base > 0:  # long tarafı
        if votes_h1 >= 0: align += 0.25
        if votes_h4 >= 0: align += 0.25
    elif votes_base < 0:  # short tarafı
        if votes_h1 <= 0: align += 0.25
        if votes_h4 <= 0: align += 0.25

    # temel oyları [-3,3] → [0,1] normalize
    def norm(v): 
        return max(0.0, min(1.0, (v + 3.0) / 6.0))
    base_s = norm(votes_base)
    h1_s   = norm(votes_h1)
    h4_s   = norm(votes_h4)

    # rejim bonusu/penaltısı
    regime = (0.2 if adx_ok else -0.2) + (0.2 if vol_ok else -0.2)

    # Slightly upweight higher TFs in the final score (stability)
    raw = 0.45*base_s + 0.3*h1_s + 0.15*h4_s + align + regime
    return max(0.0, min(1.0, raw))

def adaptive_sl_tp(price, atr, side, adx, atr_pct):
    """ATR tabanlı uyarlanabilir SL/TP oranları."""
    if not (price and atr and atr > 0):
        return None, None
    # trend güçlüyse (ADX↑) ve volatilite makulse, TP katsayısını artır
    tp_k = 2.0 + (0.5 if (adx and adx >= 20) else 0.0)
    sl_k = 1.2 if (atr_pct and atr_pct <= 0.02) else 1.5  # sakin piyasada biraz daha dar SL

    if side == "BUY":
        return round(price - sl_k*atr, 2), round(price + tp_k*atr, 2)
    if side == "SELL":
        return round(price + sl_k*atr, 2), round(price - tp_k*atr, 2)
    return None, None

def compute_signal(symbol="BTCUSDT"):
    base, h1, h4 = mtf_context(symbol)
    if base.empty or h1.empty or h4.empty:
        raise HTTPException(503, "empty indicator frames")
    b, b1, b4 = base.iloc[-1], h1.iloc[-1], h4.iloc[-1]

    side, score = compute_signal_row(b, b1, b4)
    # Dynamic threshold: base on optimizer, then adjust by regime and direction bias
    opt = _get_optimizer_suggestion(symbol)
    base_th = 0.6
    if isinstance(opt, dict):
        base_th = float(opt.get("threshold", base_th))

    atrp = safe_num(b.get("atr_pct"))
    adxv = safe_num(b.get("adx"))
    # start from optimizer threshold
    dyn_th = base_th
    # quiet or uncertain regime => demand stronger score
    if not regime_filters(b)[0] or (atrp is not None and atrp < 0.0015):
        dyn_th += 0.05
    # healthy trend & volatility window => allow slightly lower threshold
    if (adxv is not None and adxv >= 20) and (atrp is not None and 0.0015 <= atrp <= 0.02):
        dyn_th -= 0.02

    # asymmetric threshold for shorts (usually daha zordur): +0.02
    if side == "BUY" and score < dyn_th:
        side = "HOLD"
    elif side == "SELL" and score < (dyn_th + 0.02):
        side = "HOLD"
    adx_ok, vol_ok = regime_filters(b)
    v_base = directional_vote(b)
    v_h1 = directional_vote(b1)
    v_h4 = directional_vote(b4)

    # fiyat/atr/rsı (raporlama)
    price = safe_num(b["close"], 2)
    atr   = safe_num(b["atr"], 2)
    rsi   = safe_num(b["rsi"], 2)
    emaf  = safe_num(b["ema_fast"], 2)
    emas  = safe_num(b["ema_slow"], 2)
    atrp  = safe_num(b["atr_pct"], 4)
    adx   = safe_num(b["adx"], 2)

    # SL/TP
    sl, tp = adaptive_sl_tp(price, atr, side, adx, atrp)

    result = {
        "symbol": symbol,
        "side": side,
        "score": float(round(score, 2)),
        "price": price, "rsi": rsi, "atr": atr,
        "ema_fast": emaf, "ema_slow": emas, "atr_pct": atrp, "adx": adx,
        "sl": sl, "tp": tp,
        "mtf": {
            "votes": {"base15m": v_base, "h1": v_h1, "h4": v_h4},
            "filters": {"adx_ok": adx_ok, "vol_ok": vol_ok}
        },
        "optimizer": {
            "target_hit": 0.64,
            "suggestion": opt if isinstance(opt, dict) else None
        }
    }
    # cache last good signal
    try:
        _sig_cache_put(symbol, json_sanitize(result))
    except Exception:
        pass
    return result

# --- fallback signal helper ---
def _fallback_signal(symbol: str) -> dict:
    """Return a minimal neutral HOLD signal when live compute fails and cache is empty."""
    return {
        "symbol": symbol.upper(),
        "side": "HOLD",
        "score": 0.0,
        "price": None,
        "rsi": None,
        "atr": None,
        "ema_fast": None,
        "ema_slow": None,
        "atr_pct": None,
        "adx": None,
        "sl": None,
        "tp": None,
        "mtf": {
            "votes": {"base15m": 0.0, "h1": 0.0, "h4": 0.0},
            "filters": {"adx_ok": False, "vol_ok": False},
        },
        "optimizer": {"target_hit": 0.64, "suggestion": None},
    }


def backtest_signals(
    symbol: str,
    threshold: float = 0.6,
    limit: int = 400,
    horizon: int = 4,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    signals: pd.DataFrame | None = None,
    mode: str = "horizon",  # "horizon" or "atr_tp_sl"
    bootstrap: int = 0,      # number of bootstrap resamples for CIs
):
    if signals is None:
        signals = generate_signal_history(symbol, limit)
    base_frame = prepare_frame(fetch_ohlcv(symbol, "15m", limit))
    signals["fwd_return"] = signals["close"].shift(-horizon) / signals["close"] - 1
    active = signals[(signals["side"].isin(["BUY", "SELL"])) & (signals["score"] >= threshold)].copy()
    active = active.dropna(subset=["fwd_return"])
    active["direction"] = active["side"].map({"BUY": 1, "SELL": -1})
    if mode == "atr_tp_sl":
        # event-driven TP/SL: check which hits first within horizon bars
        highs = base_frame.loc[active.index, "high"]
        lows = base_frame.loc[active.index, "low"]
        closes = base_frame.loc[active.index, "close"]
        atrs = base_frame.loc[active.index, "atr"]
        adxs = base_frame.loc[active.index, "adx"]
        atrps = base_frame.loc[active.index, "atr_pct"]
        gross = []
        idx_list = list(active.index)
        for i, ts in enumerate(idx_list):
            side_i = active.loc[ts, "side"]
            price_i = safe_num(closes.loc[ts])
            atr_i = safe_num(atrs.loc[ts])
            adx_i = safe_num(adxs.loc[ts])
            atrp_i = safe_num(atrps.loc[ts])
            sl, tp = adaptive_sl_tp(price_i, atr_i, side_i, adx_i, atrp_i)
            # iterate forward bars
            win = None
            future_idx = base_frame.index
            try:
                start_pos = future_idx.get_loc(ts)
            except Exception:
                start_pos = None
            if start_pos is None:
                gross.append(0.0)
                continue
            end_pos = min(start_pos + horizon, len(future_idx) - 1)
            path = base_frame.iloc[start_pos+1:end_pos+1]
            if side_i == "BUY" and sl and tp:
                # check order: did low hit SL before high hit TP?
                hit_sl = (path["low"] <= sl)
                hit_tp = (path["high"] >= tp)
            elif side_i == "SELL" and sl and tp:
                hit_sl = (path["high"] >= sl)
                hit_tp = (path["low"] <= tp)
            else:
                hit_sl = pd.Series([], dtype=bool)
                hit_tp = pd.Series([], dtype=bool)
            first_hit = None
            if len(path) > 0:
                # find first index where either hits
                for j in range(len(path)):
                    if hit_sl.iloc[j] or hit_tp.iloc[j]:
                        first_hit = ("TP" if hit_tp.iloc[j] else "SL")
                        break
            if first_hit == "TP":
                ret = (tp - price_i) / price_i if side_i == "BUY" else (price_i - tp) / price_i
            elif first_hit == "SL":
                ret = (sl - price_i) / price_i if side_i == "BUY" else (price_i - sl) / price_i
            else:
                # fallback to horizon close if neither hit
                close_h = path["close"].iloc[-1] if len(path) else price_i
                ret = (close_h - price_i) / price_i if side_i == "BUY" else (price_i - close_h) / price_i
            gross.append(ret)
        active["gross_return"] = np.array(gross)
    else:
        active["gross_return"] = active["direction"] * active["fwd_return"]

    total_cost_bps = (commission_bps * 2.0) + (slippage_bps * 2.0)
    cost_return = total_cost_bps / 10000.0
    active["cost_return"] = cost_return
    active["net_return"] = active["gross_return"] - cost_return
    active["gross_value"] = active["gross_return"] * position_size
    active["net_value"] = active["net_return"] * position_size
    active["cum_net_value"] = active["net_value"].cumsum()
    active["atr_pct"] = signals.loc[active.index, "atr_pct"]
    active["adx"] = signals.loc[active.index, "adx"]

    bins = [0, 0.01, 0.02, float("inf")]
    labels = ["low", "medium", "high"]
    active["vol_regime"] = pd.cut(active["atr_pct"], bins=bins, labels=labels, include_lowest=True)
    active["trend_regime"] = active["adx"].apply(lambda v: "strong" if pd.notna(v) and v >= 20 else "weak")

    trades = len(active)
    gross_value_sum = float(active["gross_value"].sum()) if trades else 0.0
    net_value_sum = float(active["net_value"].sum()) if trades else 0.0
    gross_return_sum = float(active["gross_return"].sum()) if trades else 0.0
    net_return_sum = float(active["net_return"].sum()) if trades else 0.0
    hit_rate = float((active["net_value"] > 0).mean()) if trades else 0.0

    net_returns = active["net_return"].to_numpy()
    sharpe = 0.0
    sortino = 0.0
    avg_win = 0.0
    avg_loss = 0.0
    expectancy = 0.0
    max_drawdown = 0.0
    profit_factor = 0.0
    win_loss_ratio = 0.0
    median_return = 0.0
    return_std = 0.0
    quantiles: dict[str, float] = {}

    def empty_side_summary() -> dict[str, float | int]:
        return {
            "trades": 0,
            "net_return_sum": 0.0,
            "hit_rate": 0.0,
            "avg_return": 0.0,
            "avg_score": 0.0,
        }

    side_breakdown = {
        "buy": empty_side_summary(),
        "sell": empty_side_summary(),
    }
    weekday_breakdown: list[dict[str, float | int | str]] = []
    streaks = {"longest_win": 0, "longest_loss": 0}
    if trades:
        if np.std(net_returns) > 1e-8:
            sharpe = float(np.sqrt(trades) * np.mean(net_returns) / np.std(net_returns))
        downside = net_returns[net_returns < 0]
        if downside.size > 0 and np.std(downside) > 1e-8:
            sortino = float(np.mean(net_returns) / np.std(downside))
        wins = net_returns[net_returns > 0]
        losses = net_returns[net_returns < 0]
        if wins.size > 0:
            avg_win = float(np.mean(wins))
        if losses.size > 0:
            avg_loss = float(np.mean(losses))
        expectancy = float(np.mean(net_returns))
        equity = (1 + active["net_return"]).cumprod()
        running_max = equity.cummax()
        drawdown = (equity - running_max) / running_max
        max_drawdown = float(drawdown.min())

        wins_value = active.loc[active["net_value"] > 0, "net_value"].sum()
        losses_value = active.loc[active["net_value"] < 0, "net_value"].sum()
        if losses_value < 0:
            profit_factor = float(abs(wins_value) / abs(losses_value)) if abs(losses_value) > 1e-12 else float("inf")

        if avg_loss < -1e-12:
            win_loss_ratio = float(abs(avg_win / avg_loss)) if avg_win != 0 else 0.0

        median_return = float(np.median(net_returns))
        return_std = float(np.std(net_returns))
        quantile_values = np.quantile(net_returns, [0.05, 0.25, 0.5, 0.75, 0.95])
        quantiles = {
            "p05": float(quantile_values[0]),
            "p25": float(quantile_values[1]),
            "p50": float(quantile_values[2]),
            "p75": float(quantile_values[3]),
            "p95": float(quantile_values[4]),
        }

        def build_side_summary(mask: pd.Series) -> dict[str, float | int]:
            subset = active.loc[mask]
            if subset.empty:
                return empty_side_summary()
            scores = signals.loc[subset.index, "score"]
            return {
                "trades": int(len(subset)),
                "net_return_sum": float(subset["net_return"].sum()),
                "hit_rate": float((subset["net_value"] > 0).mean()) if len(subset) else 0.0,
                "avg_return": float(subset["net_return"].mean()) if len(subset) else 0.0,
                "avg_score": float(scores.mean()) if len(scores) else 0.0,
            }

        side_breakdown = {
            "buy": build_side_summary(active["side"] == "BUY"),
            "sell": build_side_summary(active["side"] == "SELL"),
        }

        if isinstance(active.index, pd.DatetimeIndex):
            day_names = active.index.day_name()
            weekday_order = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ]
            for day in weekday_order:
                mask = day_names == day
                if not mask.any():
                    continue
                grp = active.loc[mask]
                weekday_breakdown.append(
                    {
                        "day": day,
                        "trades": int(len(grp)),
                        "net_return_sum": float(grp["net_return"].sum()),
                        "hit_rate": float((grp["net_value"] > 0).mean()) if len(grp) else 0.0,
                        "avg_return": float(grp["net_return"].mean()) if len(grp) else 0.0,
                    }
                )

        longest_win = 0
        longest_loss = 0
        current_win = 0
        current_loss = 0
        for value in active["net_value"]:
            if value > 0:
                current_win += 1
                current_loss = 0
                longest_win = max(longest_win, current_win)
            elif value < 0:
                current_loss += 1
                current_win = 0
                longest_loss = max(longest_loss, current_loss)
            else:
                current_win = 0
                current_loss = 0
        streaks = {"longest_win": int(longest_win), "longest_loss": int(longest_loss)}

    recent = (
        active.tail(100)
        .reset_index()
        .loc[:, [
            "open_time",
            "side",
            "score",
            "fwd_return",
            "gross_return",
            "net_return",
            "gross_value",
            "net_value",
        ]]
    )

    history = [
        {
            "time": row["open_time"].isoformat(),
            "side": row["side"],
            "score": float(round(row["score"], 2)),
            "fwd_return": float(row["fwd_return"]),
            "gross_return": float(row["gross_return"]),
            "net_return": float(row["net_return"]),
            "gross_value": float(row["gross_value"]),
            "net_value": float(row["net_value"]),
        }
        for _, row in recent.iterrows()
    ]

    regime_metrics = []
    if trades:
        grouped = active.groupby([active["vol_regime"].fillna("unknown"), active["trend_regime"]])
        for (vol, trend), grp in grouped:
            regime_metrics.append(
                {
                    "vol_regime": str(vol),
                    "trend_regime": str(trend),
                    "trades": int(len(grp)),
                    "net_return_sum": float(grp["net_return"].sum()),
                    "hit_rate": float((grp["net_value"] > 0).mean()) if len(grp) else 0.0,
                }
            )

    score_buckets = []
    if trades:
        bucket_edges = np.arange(0.3, 1.01, 0.1)
        bucket_labels = [f"{round(bucket_edges[i],1)}-{round(bucket_edges[i+1],1)}" for i in range(len(bucket_edges) - 1)]
        bucket_series = pd.cut(signals.loc[active.index, "score"], bucket_edges, labels=bucket_labels, include_lowest=True)
        active["score_bucket"] = bucket_series.values
        grouped_scores = active.groupby(active["score_bucket"].fillna("unknown"))
        for bucket, grp in grouped_scores:
            score_buckets.append(
                {
                    "bucket": str(bucket),
                    "trades": int(len(grp)),
                    "net_return_avg": float(grp["net_return"].mean()) if len(grp) else 0.0,
                    "hit_rate": float((grp["net_value"] > 0).mean()) if len(grp) else 0.0,
                }
            )

    equity_curve = [
        {
            "time": ts.isoformat(),
            "net_value": float(val),
        }
        for ts, val in active["cum_net_value"].items()
    ]

    base_minutes = 15
    exposure_bars = trades * horizon
    total_bars = limit if limit > 0 else 0
    exposure_minutes = exposure_bars * base_minutes
    total_minutes = total_bars * base_minutes
    exposure = {
        "bars": int(exposure_bars),
        "minutes": float(exposure_minutes),
        "hours": float(exposure_minutes / 60.0) if exposure_minutes else 0.0,
        "days": float(exposure_minutes / 1440.0) if exposure_minutes else 0.0,
        "ratio": float(exposure_bars / total_bars) if total_bars else 0.0,
    }

    # --- optional bootstrap CIs for hit_rate and expectancy ---
    boot = {}
    if bootstrap and trades:
        rng = np.random.default_rng(42)
        hr = []
        ex = []
        vals = active["net_return"].to_numpy()
        wins_mask = (active["net_value"].to_numpy() > 0)
        n = len(vals)
        for _ in range(int(bootstrap)):
            idx = rng.integers(0, n, size=n)
            hr.append(float(wins_mask[idx].mean()))
            ex.append(float(vals[idx].mean()))
        hr_ci = (float(np.percentile(hr, 2.5)), float(np.percentile(hr, 97.5)))
        ex_ci = (float(np.percentile(ex, 2.5)), float(np.percentile(ex, 97.5)))
        boot = {"hit_rate_ci": hr_ci, "expectancy_ci": ex_ci, "samples": int(bootstrap)}

    return {
        "symbol": symbol,
        "threshold": threshold,
        "limit": limit,
        "horizon": horizon,
        "commission_bps": commission_bps,
        "slippage_bps": slippage_bps,
        "position_size": position_size,
        "trades": trades,
        "gross_value_sum": gross_value_sum,
        "net_value_sum": net_value_sum,
        "gross_return_sum": gross_return_sum,
        "net_return_sum": net_return_sum,
        "hit_rate": hit_rate,
        "cost_return": cost_return,
        "history": history,
        "equity_curve": equity_curve,
        "regime_metrics": regime_metrics,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": max_drawdown,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "expectancy": expectancy,
        "profit_factor": profit_factor,
        "win_loss_ratio": win_loss_ratio,
        "median_return": median_return,
        "return_std": return_std,
        "return_quantiles": quantiles,
        "side_breakdown": side_breakdown,
        "weekday_breakdown": weekday_breakdown,
        "streaks": streaks,
        "exposure": exposure,
        "score_buckets": score_buckets,
        "bootstrap": boot,
    }


def backtest_sweep(
    symbol: str,
    thresholds: list[float],
    horizons: list[int],
    limit: int,
    commission_bps: float,
    slippage_bps: float,
    position_size: float,
):
    signals = generate_signal_history(symbol, limit)
    results = []
    for th in thresholds:
        for hz in horizons:
            res = backtest_signals(
                symbol,
                threshold=th,
                limit=limit,
                horizon=hz,
                commission_bps=commission_bps,
                slippage_bps=slippage_bps,
                position_size=position_size,
                signals=signals.copy(),
            )
            results.append(res)
    return results

# --- param optimizer utility ---
def optimize_params(
    symbol: str,
    thresholds: list[float],
    horizons: list[int],
    limit: int,
    commission_bps: float,
    slippage_bps: float,
    position_size: float,
    target_hit: float = 0.64,
    min_trades: int = 25,
    mode: str = "horizon",
    walkforward: bool = False,
    folds: int = 3,
) -> dict[str, Any]:
    # Precompute once to keep results consistent and fast
    signals = generate_signal_history(symbol, limit)
    idx = signals.index
    def eval_candidate(th, hz, sig_df):
        res = backtest_signals(
            symbol,
            threshold=th,
            limit=limit,
            horizon=hz,
            commission_bps=commission_bps,
            slippage_bps=slippage_bps,
            position_size=position_size,
            signals=sig_df.copy(),
            mode=mode,
        )
        return res

    if walkforward and isinstance(idx, pd.DatetimeIndex) and len(idx) > folds*50:
        # build contiguous folds
        cut_points = np.linspace(0, len(idx), folds+1, dtype=int)
        fold_ranges = [(idx[cut_points[i]], idx[cut_points[i+1]-1]) for i in range(folds)]
    else:
        fold_ranges = None

    best: dict[str, Any] | None = None
    closest: dict[str, Any] | None = None
    best_hit_gap = 1.0

    for hz in horizons:
        for th in thresholds:
            if fold_ranges:
                agg_trades = 0
                agg_net = 0.0
                hits = []
                pfs = []
                for (s_idx, e_idx) in fold_ranges:
                    sig_df = signals.loc[s_idx:e_idx]
                    if len(sig_df) < 100:
                        continue
                    r = eval_candidate(th, hz, sig_df)
                    agg_trades += int(r.get("trades", 0))
                    agg_net += float(r.get("net_return_sum", 0.0))
                    hits.append(float(r.get("hit_rate", 0.0)))
                    pfs.append(float(r.get("profit_factor", 0.0)))
                trades = agg_trades
                hit = float(np.mean(hits)) if hits else 0.0
                pf = float(np.mean(pfs)) if pfs else 0.0
                net = agg_net
            else:
                r = eval_candidate(th, hz, signals)
                trades = int(r.get("trades", 0))
                hit    = float(r.get("hit_rate", 0.0))
                pf     = float(r.get("profit_factor", 0.0))
                net    = float(r.get("net_return_sum", 0.0))

            # Track closest to target regardless of side
            gap = abs(hit - target_hit)
            cand = {
                "threshold": th,
                "horizon": hz,
                "trades": trades,
                "hit_rate": hit,
                "profit_factor": pf,
                "net_return_sum": net,
            }

            if closest is None or gap < best_hit_gap or (abs(gap - best_hit_gap) < 1e-9 and net > closest["net_return_sum"]):
                closest = cand
                best_hit_gap = gap

            # Prefer candidates meeting target hit and min trades and PF>=1.3, then maximize net_return
            if hit >= target_hit and trades >= min_trades and pf >= 1.3:
                if best is None or net > best["net_return_sum"]:
                    best = cand

    # If none meet target, fall back to the closest hit-rate; otherwise return best
    return best or (closest or {
        "threshold": thresholds[0],
        "horizon": horizons[0],
        "trades": 0,
        "hit_rate": 0.0,
        "profit_factor": 0.0,
        "net_return_sum": 0.0,
    })


# --- Optimizer endpoint ---
@app.get("/optimize")
def optimize_endpoint(
    symbol: str = "BTCUSDT",
    thresholds: str = "0.4,0.5,0.6,0.7,0.8",
    horizons: str = "2,4,6,8",
    limit: int = 400,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    target_hit: float = 0.64,
    min_trades: int = 25,
    mode: str = "horizon",
    walkforward: bool = False,
):
    th_values = parse_float_list(thresholds)
    hz_values = parse_int_list(horizons)
    if not th_values or not hz_values:
        raise HTTPException(400, "thresholds and horizons must be non-empty")
    if any(not (0 < t < 1) for t in th_values):
        raise HTTPException(400, "threshold values must be between 0 and 1")
    if any(h < 1 or h > 50 for h in hz_values):
        raise HTTPException(400, "horizon values must be between 1 and 50")
    if limit < 100 or limit > 1000:
        raise HTTPException(400, "limit must be between 100 and 1000")
    if commission_bps < 0 or slippage_bps < 0:
        raise HTTPException(400, "commission/slippage cannot be negative")
    if position_size <= 0:
        raise HTTPException(400, "position_size must be positive")
    if not (0.5 <= target_hit <= 0.9):
        raise HTTPException(400, "target_hit must be between 0.5 and 0.9")

    try:
        best = optimize_params(
            symbol.upper(),
            th_values,
            hz_values,
            limit,
            commission_bps,
            slippage_bps,
            position_size,
            target_hit=target_hit,
            min_trades=min_trades,
            mode=mode,
            walkforward=walkforward,
        )
        return json_sanitize({
            "symbol": symbol.upper(),
            "target_hit": target_hit,
            "min_trades": min_trades,
            "mode": mode,
            "walkforward": walkforward,
            "suggestion": best,
        })
    except HTTPException as he:
        # Degrade gracefully for UI: return 200 with ok:false instead of surfacing 5xx
        return JSONResponse(status_code=200, content={
            "ok": False,
            "error": str(he.detail),
            "code": he.status_code,
        })
    except Exception as exc:
        logger.error("/optimize failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(500, "internal error while optimizing; check server logs")


# --- Lightweight debug endpoint for diagnostics ---
@app.get("/debug/predict")
def debug_predict(symbol: str = "BTCUSDT"):
    try:
        res = compute_signal(symbol)
        return {"ok": True, "data": json_sanitize(res)}
    except HTTPException as he:
        # Return details with 200 for debugging purposes
        return {"ok": False, "status": he.status_code, "error": str(he.detail)}
    except Exception as exc:
        return {"ok": False, "status": 500, "error": str(exc)}

# --- Compatibility GET endpoints for services expecting GET ---
@app.get("/signals")
def get_signals(symbol: str = "BTCUSDT"):
    try:
        res = compute_signal(symbol)
        payload = json_sanitize(res)
        return {"ok": True, "data": payload, "stale": False, **payload}
    except HTTPException as he:
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
        # no cache -> serve fallback HOLD so UI keeps working
        fb = json_sanitize(_fallback_signal(symbol))
        payload = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
    except Exception as exc:
        logger.error("/signals failed for %s: %s", symbol, exc)
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
        fb = json_sanitize(_fallback_signal(symbol))
        payload = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})

@app.get("/predict")
def predict_get(symbol: str = "BTCUSDT"):
    try:
        res = compute_signal(symbol)
        payload = json_sanitize(res)
        return {"ok": True, "data": payload, "stale": False, **payload}
    except HTTPException as he:
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
        fb = json_sanitize(_fallback_signal(symbol))
        payload = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
    except Exception as exc:
        logger.error("GET /predict failed for %s: %s", symbol, exc)
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})
        fb = json_sanitize(_fallback_signal(symbol))
        payload = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload, "stale": True, **payload})


@app.post("/predict")
def predict(payload: dict):
    symbol = payload.get("symbol", "BTCUSDT")
    try:
        res = compute_signal(symbol)
        payload_result = json_sanitize(res)
        return {"ok": True, "data": payload_result, "stale": False, **payload_result}
    except HTTPException as he:
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload_result = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload_result, "stale": True, **payload_result})
        fb = json_sanitize(_fallback_signal(symbol))
        payload_result = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload_result, "stale": True, **payload_result})
    except Exception as exc:
        logger.error("/predict failed for %s: %s\n%s", symbol, exc, traceback.format_exc())
        cached = _sig_cache_get(symbol)
        if cached is not None:
            payload_result = cached
            return JSONResponse(status_code=200, content={"ok": True, "data": payload_result, "stale": True, **payload_result})
        fb = json_sanitize(_fallback_signal(symbol))
        payload_result = fb
        return JSONResponse(status_code=200, content={"ok": True, "data": payload_result, "stale": True, **payload_result})


@app.get("/backtest")
def backtest(
    symbol: str = "BTCUSDT",
    threshold: float = 0.6,
    limit: int = 400,
    horizon: int = 4,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    mode: str = "horizon",
    bootstrap: int = 0,
):
    if not (0 < threshold < 1):
        raise HTTPException(400, "threshold must be between 0 and 1")
    if limit < 100 or limit > 1000:
        raise HTTPException(400, "limit must be between 100 and 1000")
    if horizon < 1 or horizon > 50:
        raise HTTPException(400, "horizon must be between 1 and 50")
    if commission_bps < 0 or slippage_bps < 0:
        raise HTTPException(400, "commission/slippage cannot be negative")
    if position_size <= 0:
        raise HTTPException(400, "position_size must be positive")

    try:
        res = backtest_signals(
            symbol.upper(),
            threshold,
            limit,
            horizon,
            commission_bps=commission_bps,
            slippage_bps=slippage_bps,
            position_size=position_size,
            mode=mode,
            bootstrap=bootstrap,
        )
        return json_sanitize(res)
    except HTTPException as he:
        raise he
    except Exception as exc:
        logger.error("/backtest failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(500, "internal error while backtesting; check server logs")


@app.get("/backtest/sweep")
def backtest_sweep_endpoint(
    symbol: str = "BTCUSDT",
    thresholds: str = "0.4,0.5,0.6,0.7",
    horizons: str = "2,4,6",
    limit: int = 400,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
):
    th_values = parse_float_list(thresholds)
    hz_values = parse_int_list(horizons)
    if not th_values or not hz_values:
        raise HTTPException(400, "thresholds and horizons must be non-empty")
    if any(not (0 < t < 1) for t in th_values):
        raise HTTPException(400, "threshold values must be between 0 and 1")
    if any(h < 1 or h > 50 for h in hz_values):
        raise HTTPException(400, "horizon values must be between 1 and 50")
    if limit < 100 or limit > 1000:
        raise HTTPException(400, "limit must be between 100 and 1000")
    if commission_bps < 0 or slippage_bps < 0:
        raise HTTPException(400, "commission/slippage cannot be negative")
    if position_size <= 0:
        raise HTTPException(400, "position_size must be positive")

    try:
        results = backtest_sweep(
            symbol.upper(),
            th_values,
            hz_values,
            limit,
            commission_bps,
            slippage_bps,
            position_size,
        )
    except HTTPException as he:
        raise he
    except Exception as exc:
        logger.error("/backtest/sweep failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(500, "internal error while running sweep; check server logs")

    return json_sanitize({
        "symbol": symbol.upper(),
        "thresholds": th_values,
        "horizons": hz_values,
        "limit": limit,
        "commission_bps": commission_bps,
        "slippage_bps": slippage_bps,
        "position_size": position_size,
        "results": results,
    })


# --- Readiness endpoint for data-path health ---
# --- Readiness endpoint for data-path health ---
# --- Market overview endpoints ---
@app.get("/market/summary")
def market_summary(
    symbols: Optional[str] = None,
    top_n: int = 0,
    with_indicators: bool = True,
):
    """Return 24h stats for many coins plus optional indicator snapshot.
    - If `symbols` is provided (comma-separated), fetch just those symbols.
    - Else, fetch all and return `top_n` by quoteVolume (default 0 => all; cap to 200).
    """
    try:
        syms: Optional[list[str]] = parse_symbol_list(symbols) if symbols else None
        if not syms and top_n > 0:
            top_n = min(top_n, 200)
        tickers = fetch_24h_tickers(syms, top_n if (not syms) else None)
        out = []
        for t in tickers:
            sym = str(t.get("symbol", "")).upper()
            item = {
                "symbol": sym,
                "lastPrice": safe_num(t.get("lastPrice"), 6),
                "priceChangePercent": safe_num(t.get("priceChangePercent"), 4),
                "volume": safe_num(t.get("volume"), 4),
                "quoteVolume": safe_num(t.get("quoteVolume"), 2),
                "highPrice": safe_num(t.get("highPrice"), 6),
                "lowPrice": safe_num(t.get("lowPrice"), 6),
            }
            if with_indicators and sym:
                try:
                    item["indicators"] = last_indicators_snapshot(sym)
                except Exception as exc:
                    item["indicators_error"] = str(exc)
            out.append(item)
        return {"ok": True, "count": len(out), "data": json_sanitize(out)}
    except HTTPException as he:
        # Soft-fail for UI: do not surface 5xx here; return ok:false with code so the page doesn't show a global error
        logger.warning("/market/summary soft error: %s", he.detail)
        return JSONResponse(status_code=200, content={
            "ok": False,
            "error": str(he.detail),
            "code": he.status_code,
        })
    except Exception as exc:
        logger.error("/market/summary failed: %s", exc)
        return JSONResponse(status_code=200, content={"ok": False, "error": "ai-service-internal"})


@app.get("/signals/batch")
def signals_batch(symbols: str):
    """Compute signals for a list of symbols (comma-separated)."""
    syms = parse_symbol_list(symbols)
    if not syms:
        raise HTTPException(400, "symbols must be non-empty")
    results = []
    for s in syms[:25]:  # simple guard
        try:
            results.append({"symbol": s, "data": compute_signal(s)})
        except HTTPException as he:
            results.append({"symbol": s, "error": str(he.detail), "status": he.status_code})
        except Exception as exc:
            results.append({"symbol": s, "error": str(exc)})
    return json_sanitize({"ok": True, "count": len(results), "results": results})

# --- Readiness endpoint for data-path health ---
@app.get("/readiness")
def readiness(symbol: str = "BTCUSDT"):
    try:
        df = fetch_ohlcv(symbol, "15m", 60)
        ok = bool(df is not None and len(df) >= 50)
        return {"ok": ok, "rows": 0 if df is None else int(len(df))}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}