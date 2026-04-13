from __future__ import annotations

import math
import os
import time
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from requests.adapters import HTTPAdapter

try:
    from urllib3.util.retry import Retry
except Exception:  # pragma: no cover
    from requests.packages.urllib3.util.retry import Retry  # type: ignore

import logging
import traceback

from analysis_engine import (
    apply_ai_validation_outcome,
    apply_quality_first_signal_filter,
    build_analysis,
    build_indicator_frame,
    build_indicator_snapshot,
    coin_profile,
    normalize_timeframe,
    safe_float,
    scenario_summary,
    trend_bias,
    trend_label,
)
from explanation_engine import generate_endpoint_insight, generate_explanation, generate_insight, validate_signal_setup
from validation import validate_analysis_history


def json_sanitize(value: Any):
    if isinstance(value, dict):
        return {key: json_sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_sanitize(item) for item in value]
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    try:
        if isinstance(value, (np.floating,)):
            cast = float(value)
            return cast if math.isfinite(cast) else None
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.bool_,)):
            return bool(value)
    except Exception:
        pass
    return value


def parse_float_list(value: str) -> list[float]:
    try:
        return [float(item) for item in value.split(",") if item.strip()]
    except Exception as exc:
        raise HTTPException(400, "invalid float list") from exc


def parse_int_list(value: str) -> list[int]:
    try:
        return [int(item) for item in value.split(",") if item.strip()]
    except Exception as exc:
        raise HTTPException(400, "invalid int list") from exc


def parse_symbol_list(value: str) -> list[str]:
    try:
        items = [item.strip().upper() for item in value.split(",") if item.strip()]
        return [symbol for symbol in items if symbol.isalnum() and 4 <= len(symbol) <= 20]
    except Exception as exc:
        raise HTTPException(400, "invalid symbols list") from exc


BASE_SUPPORTED_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
]
SUPPORTED_SYMBOLS = list(BASE_SUPPORTED_SYMBOLS)
BASE_SUPPORTED_SYMBOL_SET = frozenset(BASE_SUPPORTED_SYMBOLS)
SUPPORTED_SYMBOL_SET = frozenset(SUPPORTED_SYMBOLS)

TIMEFRAME_TO_INTERVAL = {
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}
SUPPORTED_TIMEFRAMES = tuple(TIMEFRAME_TO_INTERVAL.keys())
TIMEFRAME_TO_SECONDS = {
    "1h": 3600,
    "4h": 4 * 3600,
    "1d": 24 * 3600,
}
MIN_CANDLES_REQUIRED = 220

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

logger = logging.getLogger("ai-service")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


@app.exception_handler(Exception)
async def _unhandled_error(request: Request, exc: Exception):
    logger.error("unhandled error on %s: %s", request.url.path, exc, exc_info=True)
    path = request.url.path if request else ""
    if path.startswith(("/signals", "/predict", "/market", "/optimize")):
        return JSONResponse(status_code=200, content={"ok": False, "error": "ai-service-internal", "path": path})
    return JSONResponse(status_code=500, content={"ok": False, "error": "ai-service-internal"})


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
_SESSION.headers.update(
    {
        "User-Agent": "cortexa-ai-service/2.0 (+https://www.cortexaai.net)",
        "Accept": "application/json",
    }
)
_SESSION.mount("https://", HTTPAdapter(max_retries=_retry))
_SESSION.mount("http://", HTTPAdapter(max_retries=_retry))

_BINANCE_BASE_URL = os.getenv("BINANCE_BASE_URL", "https://api.binance.com").rstrip("/")
_BINANCE_TICKER_URL = f"{_BINANCE_BASE_URL}/api/v3/ticker/24hr"
_BINANCE_EXCHANGE_INFO_URL = f"{_BINANCE_BASE_URL}/api/v3/exchangeInfo"
_BINANCE_KLINES_URL = f"{_BINANCE_BASE_URL}/api/v3/klines"
_OHLCV_CACHE: Dict[tuple[str, str, int], tuple[float, pd.DataFrame]] = {}
_OHLCV_TTL_SEC = int(os.getenv("OHLCV_TTL_SEC", "20"))
_ANALYSIS_CACHE: Dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
_ANALYSIS_TTL_SEC = int(os.getenv("SIG_TTL_SEC", "60"))
_SYMBOLS_CACHE: tuple[float, list[str]] | None = None
_SYMBOLS_TTL_SEC = int(os.getenv("SYMBOLS_TTL_SEC", "900"))
_MIN_USDT_QUOTE_VOLUME = float(os.getenv("BINANCE_MIN_USDT_QUOTE_VOLUME", "1000000"))
_TARGET_SYMBOL_COVERAGE = float(os.getenv("BINANCE_TARGET_SYMBOL_COVERAGE", "0.8"))
_MAX_SUPPORTED_SYMBOLS = int(os.getenv("BINANCE_MAX_SUPPORTED_SYMBOLS", "180"))
_MIN_SUPPORTED_SYMBOLS = int(os.getenv("BINANCE_MIN_SUPPORTED_SYMBOLS", "40"))


def _leveraged_or_wrapper_symbol(base_asset: str, symbol: str) -> bool:
    base = (base_asset or "").upper()
    normalized = (symbol or "").upper()
    leveraged_suffixes = ("UP", "DOWN", "BULL", "BEAR")
    return any(base.endswith(suffix) for suffix in leveraged_suffixes) or normalized.endswith(("UPUSDT", "DOWNUSDT", "BULLUSDT", "BEARUSDT"))


def fetch_supported_symbols(*, force_refresh: bool = False) -> list[str]:
    global _SYMBOLS_CACHE

    if not force_refresh and _SYMBOLS_CACHE is not None:
        cached_at, cached_symbols = _SYMBOLS_CACHE
        if time.time() - cached_at <= _SYMBOLS_TTL_SEC and cached_symbols:
            return list(cached_symbols)

    try:
        exchange_info = _SESSION.get(_BINANCE_EXCHANGE_INFO_URL, timeout=12)
        tickers_response = _SESSION.get(_BINANCE_TICKER_URL, timeout=12)
        if exchange_info.status_code != 200 or tickers_response.status_code != 200:
            raise HTTPException(502, "binance symbol universe unavailable")

        exchange_payload = exchange_info.json()
        tickers_payload = tickers_response.json()
        if not isinstance(exchange_payload, dict) or not isinstance(tickers_payload, list):
            raise HTTPException(502, "unexpected binance symbol payload")

        ticker_map: dict[str, float] = {}
        for item in tickers_payload:
            symbol = str(item.get("symbol", "")).upper()
            try:
                ticker_map[symbol] = float(item.get("quoteVolume", 0) or 0.0)
            except (TypeError, ValueError):
                ticker_map[symbol] = 0.0

        liquid_candidates: list[tuple[str, float]] = []
        for item in exchange_payload.get("symbols", []):
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", "")).upper()
            quote_asset = str(item.get("quoteAsset", "")).upper()
            base_asset = str(item.get("baseAsset", "")).upper()
            status = str(item.get("status", "")).upper()
            if quote_asset != "USDT" or status != "TRADING":
                continue
            if item.get("isSpotTradingAllowed") is False:
                continue
            if _leveraged_or_wrapper_symbol(base_asset, symbol):
                continue
            liquid_candidates.append((symbol, ticker_map.get(symbol, 0.0)))

        if not liquid_candidates:
            raise HTTPException(502, "no liquid USDT pairs returned")

        liquid_candidates.sort(key=lambda entry: entry[1], reverse=True)
        target_count = min(
            len(liquid_candidates),
            max(_MIN_SUPPORTED_SYMBOLS, int(math.ceil(len(liquid_candidates) * max(0.25, min(_TARGET_SYMBOL_COVERAGE, 0.95))))),
            _MAX_SUPPORTED_SYMBOLS,
        )

        selected = [
            symbol
            for index, (symbol, quote_volume) in enumerate(liquid_candidates)
            if index < target_count and (quote_volume >= _MIN_USDT_QUOTE_VOLUME or index < _MIN_SUPPORTED_SYMBOLS)
        ]
        symbols = list(dict.fromkeys(selected + BASE_SUPPORTED_SYMBOLS))
        _SYMBOLS_CACHE = (time.time(), symbols)
        return list(symbols)
    except Exception as exc:
        logger.warning("falling back to baseline symbols: %s", exc)
        fallback = list(BASE_SUPPORTED_SYMBOLS)
        _SYMBOLS_CACHE = (time.time(), fallback)
        return fallback


def _cache_get(symbol: str, interval: str, limit: int) -> pd.DataFrame | None:
    record = _OHLCV_CACHE.get((symbol.upper(), interval, int(limit)))
    if not record:
        return None
    ts, data = record
    if time.time() - ts <= _OHLCV_TTL_SEC and not data.empty:
        return data.copy()
    return None


def _cache_get_stale(symbol: str, interval: str, limit: int) -> pd.DataFrame | None:
    record = _OHLCV_CACHE.get((symbol.upper(), interval, int(limit)))
    if not record:
        return None
    _, data = record
    return data.copy() if not data.empty else None


def _cache_put(symbol: str, interval: str, limit: int, df: pd.DataFrame) -> None:
    _OHLCV_CACHE[(symbol.upper(), interval, int(limit))] = (time.time(), df.copy())


def _analysis_cache_get(symbol: str, timeframe: str) -> dict[str, Any] | None:
    record = _ANALYSIS_CACHE.get((symbol.upper(), normalize_timeframe(timeframe)))
    if not record:
        return None
    ts, data = record
    if time.time() - ts <= _ANALYSIS_TTL_SEC:
        return data.copy()
    return None


def _analysis_cache_put(symbol: str, timeframe: str, payload: dict[str, Any]) -> None:
    _ANALYSIS_CACHE[(symbol.upper(), normalize_timeframe(timeframe))] = (time.time(), payload.copy())


def validate_symbol(symbol: str) -> str:
    normalized = (symbol or "").strip().upper()
    if normalized in BASE_SUPPORTED_SYMBOL_SET:
        return normalized
    supported_symbols = fetch_supported_symbols()
    if normalized not in set(supported_symbols):
        raise HTTPException(400, f"unsupported symbol; supported symbols: {', '.join(supported_symbols[:40])}")
    return normalized


def validate_timeframe(timeframe: str | None) -> str:
    normalized = normalize_timeframe(timeframe)
    if normalized not in TIMEFRAME_TO_INTERVAL:
        raise HTTPException(400, f"unsupported timeframe; supported timeframes: {', '.join(SUPPORTED_TIMEFRAMES)}")
    return normalized


def parse_predict_payload(payload: dict[str, Any]) -> tuple[str, str]:
    symbol = validate_symbol(str(payload.get("symbol", "BTCUSDT")))
    timeframe = validate_timeframe(str(payload.get("timeframe") or payload.get("interval") or "1h"))
    return symbol, timeframe


def fetch_24h_tickers(symbols: Optional[list[str]] = None, top_n: Optional[int] = None) -> list[dict]:
    try:
        if symbols:
            results = []
            for symbol in symbols:
                validated = validate_symbol(symbol)
                response = _SESSION.get(_BINANCE_TICKER_URL, params={"symbol": validated}, timeout=8)
                if response.status_code == 200:
                    results.append(response.json())
            return results

        response = _SESSION.get(_BINANCE_TICKER_URL, timeout=12)
        if response.status_code != 200:
            raise HTTPException(502, f"ticker list failed: {response.status_code}")
        payload = response.json()
        if not isinstance(payload, list):
            raise HTTPException(502, "unexpected ticker payload")
        if top_n and top_n > 0:
            payload.sort(key=lambda item: float(item.get("quoteVolume", 0) or 0), reverse=True)
            payload = payload[:top_n]
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("fetch_24h_tickers error: %s", exc)
        raise HTTPException(502, "failed to fetch 24h tickers")


def fetch_ohlcv_with_meta(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 300) -> tuple[pd.DataFrame, bool]:
    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(interval)
    interval = TIMEFRAME_TO_INTERVAL[timeframe]
    limit = max(int(limit), MIN_CANDLES_REQUIRED)
    cached = _cache_get(symbol, interval, limit)
    if cached is not None:
        return cached, False

    errors: list[str] = []
    for attempt in range(3):
        try:
            response = _SESSION.get(
                _BINANCE_KLINES_URL,
                params={"symbol": symbol, "interval": interval, "limit": limit},
                timeout=15,
            )
        except requests.RequestException as exc:
            errors.append(f"binance request failed ({exc}) [{attempt + 1}/3]")
            time.sleep(0.2 * (2**attempt))
            continue

        if response.status_code != 200:
            errors.append(f"binance status {response.status_code} [{attempt + 1}/3]")
            time.sleep(0.2 * (2**attempt))
            continue

        try:
            payload = response.json()
        except ValueError as exc:
            errors.append(f"binance invalid json ({exc}) [{attempt + 1}/3]")
            continue

        if not payload:
            errors.append(f"binance empty klines [{attempt + 1}/3]")
            continue

        frame = pd.DataFrame(
            payload,
            columns=["time", "open", "high", "low", "close", "volume", "ct", "qv", "n", "tb", "tq", "ig"],
        )
        for column in ("open", "high", "low", "close", "volume"):
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame = frame.dropna(subset=["open", "high", "low", "close"]).copy()
        frame["symbol"] = symbol
        if len(frame) < 200:
            errors.append(f"binance insufficient rows ({len(frame)}) [{attempt + 1}/3]")
            continue
        _cache_put(symbol, interval, limit, frame)
        return frame, False

    stale = _cache_get_stale(symbol, interval, limit)
    if stale is not None:
        logger.warning("serving stale Binance cache for %s %s after errors: %s", symbol, interval, " | ".join(errors))
        return stale, True
    raise HTTPException(502, "binance market data unavailable: " + " | ".join(errors))


def fetch_ohlcv(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 300) -> pd.DataFrame:
    frame, _ = fetch_ohlcv_with_meta(symbol, interval, limit)
    return frame


def data_age_seconds(frame: pd.DataFrame) -> float | None:
    if frame.empty or "time" not in frame.columns:
        return None
    try:
        latest_time = float(frame.iloc[-1]["time"]) / 1000.0
    except (TypeError, ValueError):
        return None
    return max(0.0, time.time() - latest_time)


def is_data_stale(frame: pd.DataFrame, timeframe: str) -> bool:
    age_seconds = data_age_seconds(frame)
    if age_seconds is None:
        return False
    return age_seconds > TIMEFRAME_TO_SECONDS[timeframe] * 2.25


def apply_market_quality_filters(
    analysis: dict[str, Any],
    latest_row: pd.Series,
    *,
    timeframe: str | None = None,
    stale: bool,
    higher_timeframe_trend: str | None = None,
    higher_timeframe_stale: bool = False,
    mtf_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return apply_quality_first_signal_filter(
        analysis,
        latest_row,
        timeframe=timeframe,
        stale=stale,
        higher_timeframe_trend=higher_timeframe_trend,
        higher_timeframe_stale=higher_timeframe_stale,
        mtf_context=mtf_context,
    )


def compute_analysis(symbol: str = "BTCUSDT", timeframe: str = "1h", limit: int = 300) -> dict[str, Any]:
    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(timeframe)
    raw_frame, served_from_stale_cache = fetch_ohlcv_with_meta(symbol, timeframe, max(limit, MIN_CANDLES_REQUIRED))
    indicator_frame = build_indicator_frame(raw_frame)
    if len(indicator_frame) < 200:
        raise HTTPException(503, "not enough data for indicators")

    analysis = build_analysis(indicator_frame, symbol=symbol, timeframe=timeframe)
    stale = served_from_stale_cache or is_data_stale(raw_frame, timeframe)

    higher_timeframe_trend: str | None = None
    higher_timeframe_stale = False
    mtf_context: dict[str, Any] = {
        "aligned_count": 0,
        "conflict_count": 0,
        "aligned_timeframes": [],
        "conflicting_timeframes": [],
        "reference_trend": None,
    }
    reference_bias = trend_bias(str(analysis.get("trend", "Neutral")))
    companion_timeframes = [candidate for candidate in ("1h", "4h", "1d") if candidate != timeframe]
    companion_biases: list[int] = []
    companion_trends: list[str] = []
    for companion in companion_timeframes:
        try:
            companion_raw, companion_served_from_stale_cache = fetch_ohlcv_with_meta(symbol, companion, max(limit, MIN_CANDLES_REQUIRED))
            companion_frame = build_indicator_frame(companion_raw)
            if len(companion_frame) < 200:
                continue
            companion_analysis = build_analysis(companion_frame, symbol=symbol, timeframe=companion)
            companion_trend = str(companion_analysis["trend"])
            companion_bias = trend_bias(companion_trend)
            companion_stale = companion_served_from_stale_cache or is_data_stale(companion_raw, companion)
            companion_trends.append(companion_trend)
            if companion_stale:
                higher_timeframe_stale = True
                continue
            if companion_bias == 0 or reference_bias == 0:
                continue
            companion_biases.append(companion_bias)
            if companion_bias * reference_bias > 0:
                mtf_context["aligned_count"] += 1
                mtf_context["aligned_timeframes"].append(companion)
            else:
                mtf_context["conflict_count"] += 1
                mtf_context["conflicting_timeframes"].append(companion)
        except HTTPException as exc:
            logger.warning("skipping %s confirmation for %s: %s", companion, symbol, exc.detail)

    if companion_trends:
        bullish_votes = sum(1 for item in companion_trends if item in {"Bullish", "Strong Bullish"})
        bearish_votes = sum(1 for item in companion_trends if item in {"Bearish", "Strong Bearish"})
        if bullish_votes > bearish_votes:
            higher_timeframe_trend = "Bullish"
        elif bearish_votes > bullish_votes:
            higher_timeframe_trend = "Bearish"
        mtf_context["reference_trend"] = higher_timeframe_trend

    analysis = apply_market_quality_filters(
        analysis,
        indicator_frame.iloc[-1],
        timeframe=timeframe,
        stale=stale,
        higher_timeframe_trend=higher_timeframe_trend,
        higher_timeframe_stale=higher_timeframe_stale,
        mtf_context=mtf_context,
    )

    validation_input = {
        "symbol": analysis.get("symbol"),
        "timeframe": analysis.get("timeframe"),
        "trend": analysis.get("trend"),
        "confidence": analysis.get("confidence"),
        "risk": analysis.get("risk"),
        "market_regime": analysis.get("market_regime"),
        "quality_flags": analysis.get("quality_flags"),
        "price": analysis.get("price"),
        "indicators": analysis.get("indicators"),
        "levels": analysis.get("levels"),
        "scenario": analysis.get("scenario"),
        "scoring": analysis.get("scoring"),
        "coin_profile": analysis.get("coin_profile") or coin_profile(symbol),
    }
    ai_validation = validate_signal_setup(validation_input)
    if ai_validation.get("valid_setup") is None:
        analysis["ai_validated"] = None
        analysis["ai_setup_quality"] = ai_validation.get("setup_quality")
        analysis["ai_validation_reason"] = ai_validation.get("reason")
        analysis["ai_confidence_adjustment"] = 0
    else:
        analysis = apply_ai_validation_outcome(analysis, ai_validation)

    analysis["insight"] = generate_insight(analysis)
    analysis["explanation"] = generate_explanation(analysis)

    indicators = analysis["indicators"]
    analysis["rsi"] = indicators["rsi"]
    analysis["atr"] = indicators["atr"]
    analysis["adx"] = indicators["adx"]
    analysis["atr_pct"] = safe_float(
        indicator_frame.iloc[-1]["atr_pct"],
        4,
    )

    _analysis_cache_put(symbol, timeframe, json_sanitize(analysis))
    return analysis


def _fallback_analysis(symbol: str, timeframe: str) -> dict[str, Any]:
    normalized_symbol = validate_symbol(symbol)
    normalized_timeframe = validate_timeframe(timeframe)
    return {
        "symbol": normalized_symbol,
        "timeframe": normalized_timeframe,
        "trend": "Neutral",
        "momentum": "Weak",
        "risk": "Medium",
        "confidence": 50,
        "market_regime": "Unavailable",
        "price": None,
        "indicators": {
            "ema20": None,
            "ema50": None,
            "ema200": None,
            "rsi": None,
            "macd": {"macd": None, "signal": None, "histogram": None},
            "adx": None,
            "atr": None,
            "volume_ratio": None,
        },
        "levels": {"support": None, "resistance": None},
        "scenario": "Fresh market structure is unavailable right now. Recheck after data connectivity recovers.",
        "insight": "Market structure is temporarily unavailable, so directional conviction is limited until fresh data is restored.",
        "explanation": "Fresh market structure is unavailable right now. Recheck after data connectivity recovers.",
        "disclaimer": "This is not financial advice. It is an informational market analysis.",
        "rsi": None,
        "atr": None,
        "adx": None,
        "atr_pct": None,
        "scoring": {
            "trend": 0,
            "momentum": 0,
            "trend_strength": 0,
            "volume_confirmation": 0,
            "risk_adjustment": 0,
            "raw_score": 50.0,
            "market_quality": -15,
            "multi_timeframe_confirmation": 0,
        },
        "quality_flags": ["stale_data"],
        "stale": True,
        "side": "HOLD",
        "ai_validated": None,
        "ai_setup_quality": "medium",
        "ai_validation_reason": "AI validation unavailable; deterministic fallback used.",
        "ai_confidence_adjustment": 0,
        "coin_profile": coin_profile(normalized_symbol),
    }


def analysis_payload(symbol: str, timeframe: str = "1h") -> dict[str, Any]:
    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(timeframe)
    try:
        payload = compute_analysis(symbol, timeframe)
        return {"ok": True, "data": json_sanitize(payload), "stale": False}
    except HTTPException:
        cached = _analysis_cache_get(symbol, timeframe)
        if cached is not None:
            return {"ok": True, "data": cached, "stale": True}
        fallback = json_sanitize(_fallback_analysis(symbol, timeframe))
        return {"ok": True, "data": fallback, "stale": True}
    except Exception as exc:
        logger.error("analysis payload failed for %s %s: %s", symbol, timeframe, exc)
        cached = _analysis_cache_get(symbol, timeframe)
        if cached is not None:
            return {"ok": True, "data": cached, "stale": True}
        fallback = json_sanitize(_fallback_analysis(symbol, timeframe))
        return {"ok": True, "data": fallback, "stale": True}


def last_indicators_snapshot(symbol: str, timeframe: str = "1h") -> dict[str, Any]:
    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(timeframe)
    frame = build_indicator_frame(fetch_ohlcv(symbol, timeframe, MIN_CANDLES_REQUIRED))
    latest = frame.iloc[-1]
    snapshot = build_indicator_snapshot(latest)
    snapshot["price"] = safe_float(latest.get("close"), 2)
    snapshot["atr_pct"] = safe_float(latest.get("atr_pct"), 4)
    snapshot["trend"] = build_analysis(frame, symbol=symbol, timeframe=timeframe)["trend"]
    return json_sanitize(snapshot)


@app.get("/")
def root():
    return {"ok": True, "service": "ai-service"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/symbols")
def get_symbols(top_n: int = 0, only_usdt: bool = True):
    try:
        symbols = fetch_supported_symbols()
        if top_n > 0:
            symbols = symbols[:top_n]
        if only_usdt:
            symbols = [symbol for symbol in symbols if symbol.endswith("USDT")]
        return {"ok": True, "symbols": list(dict.fromkeys(symbols))}
    except Exception:
        return JSONResponse(status_code=200, content={"ok": False, "symbols": BASE_SUPPORTED_SYMBOLS})


@app.get("/market/symbols")
def market_symbols():
    symbols = fetch_supported_symbols()
    return {"ok": True, "provider": "binance", "symbols": symbols, "timeframes": list(SUPPORTED_TIMEFRAMES)}


@app.get("/signals")
def get_signals(symbol: str = "BTCUSDT", timeframe: str = "1h"):
    return analysis_payload(symbol, timeframe)


@app.get("/predict")
def predict_get(symbol: str = "BTCUSDT", timeframe: str = "1h"):
    return analysis_payload(symbol, timeframe)


@app.post("/predict")
def predict(payload: dict[str, Any]):
    symbol, timeframe = parse_predict_payload(payload)
    return analysis_payload(symbol, timeframe)


@app.post("/insight")
def insight(payload: dict[str, Any]):
    return {"insight": generate_endpoint_insight(payload)}


@app.get("/debug/predict")
def debug_predict(symbol: str = "BTCUSDT", timeframe: str = "1h"):
    try:
        data = compute_analysis(symbol, timeframe)
        return {"ok": True, "data": json_sanitize(data)}
    except HTTPException as exc:
        return {"ok": False, "status": exc.status_code, "error": str(exc.detail)}
    except Exception as exc:
        return {"ok": False, "status": 500, "error": str(exc)}


@app.get("/backtest")
def backtest(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    threshold: float = 0.6,
    limit: int = 400,
    horizon: int = 4,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    use_ai_validation: bool = True,
    mode: str = "horizon",
    bootstrap: int = 0,
):
    if not (0 < threshold < 1):
        raise HTTPException(400, "threshold must be between 0 and 1")
    if limit < 220 or limit > 2000:
        raise HTTPException(400, "limit must be between 220 and 2000")
    if horizon < 1 or horizon > 50:
        raise HTTPException(400, "horizon must be between 1 and 50")
    if commission_bps < 0 or slippage_bps < 0:
        raise HTTPException(400, "commission/slippage cannot be negative")
    if position_size <= 0:
        raise HTTPException(400, "position_size must be positive")

    try:
        del mode, bootstrap
        symbol = validate_symbol(symbol)
        timeframe = validate_timeframe(timeframe)
        frame = fetch_ohlcv(symbol, timeframe, limit)
        result = validate_analysis_history(
            frame,
            symbol=symbol,
            timeframe=timeframe,
            threshold=threshold,
            horizon=horizon,
            commission_bps=commission_bps,
            slippage_bps=slippage_bps,
            position_size=position_size,
            use_ai_validation=use_ai_validation,
        )
        return json_sanitize(result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("/backtest failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(500, "internal error while backtesting; check server logs")


@app.get("/backtest/sweep")
def backtest_sweep_endpoint(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    thresholds: str = "0.4,0.5,0.6,0.7",
    horizons: str = "1,4,12",
    limit: int = 400,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    use_ai_validation: bool = True,
):
    threshold_values = parse_float_list(thresholds)
    horizon_values = parse_int_list(horizons)
    if not threshold_values or not horizon_values:
        raise HTTPException(400, "thresholds and horizons must be non-empty")

    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(timeframe)
    frame = fetch_ohlcv(symbol, timeframe, limit)
    results = [
        validate_analysis_history(
            frame,
            symbol=symbol,
            timeframe=timeframe,
            threshold=threshold_value,
            horizon=horizon_value,
            commission_bps=commission_bps,
            slippage_bps=slippage_bps,
            position_size=position_size,
            use_ai_validation=use_ai_validation,
        )
        for threshold_value in threshold_values
        for horizon_value in horizon_values
    ]

    return json_sanitize(
        {
            "symbol": symbol,
            "thresholds": threshold_values,
            "horizons": horizon_values,
            "limit": limit,
            "commission_bps": commission_bps,
            "slippage_bps": slippage_bps,
            "position_size": position_size,
            "use_ai_validation": use_ai_validation,
            "results": results,
        }
    )


@app.get("/optimize")
def optimize_endpoint(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    thresholds: str = "0.4,0.5,0.6,0.7,0.8",
    horizons: str = "1,4,12",
    limit: int = 400,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
    target_hit: float = 0.64,
    min_trades: int = 25,
    use_ai_validation: bool = True,
    mode: str = "horizon",
    walkforward: bool = False,
):
    del mode, walkforward
    threshold_values = parse_float_list(thresholds)
    horizon_values = parse_int_list(horizons)
    symbol = validate_symbol(symbol)
    timeframe = validate_timeframe(timeframe)
    frame = fetch_ohlcv(symbol, timeframe, limit)

    best: dict[str, Any] | None = None
    closest: dict[str, Any] | None = None
    smallest_gap = 99.0

    for threshold_value in threshold_values:
        for horizon_value in horizon_values:
            result = validate_analysis_history(
                frame,
                symbol=symbol,
                timeframe=timeframe,
                threshold=threshold_value,
                horizon=horizon_value,
                commission_bps=commission_bps,
                slippage_bps=slippage_bps,
                position_size=position_size,
                use_ai_validation=use_ai_validation,
            )
            trades = int(result["trades"])
            hit_rate = float(result["hit_rate"])
            gap = abs(hit_rate - target_hit)
            candidate = {
                "threshold": threshold_value,
                "horizon": horizon_value,
                "trades": trades,
                "hit_rate": hit_rate,
                "profit_factor": float(result.get("profit_factor", 0.0)),
                "net_return_sum": float(result.get("net_return_sum", 0.0)),
            }

            if closest is None or gap < smallest_gap:
                closest = candidate
                smallest_gap = gap
            if trades >= min_trades and hit_rate >= target_hit:
                if best is None or candidate["net_return_sum"] > best["net_return_sum"]:
                    best = candidate

    return json_sanitize(
        {
            "symbol": symbol,
            "timeframe": timeframe,
            "target_hit": target_hit,
            "min_trades": min_trades,
            "suggestion": best or closest,
        }
    )


@app.get("/market/summary")
def market_summary(symbols: Optional[str] = None, top_n: int = 0, with_indicators: bool = True, timeframe: str = "1h"):
    try:
        timeframe = validate_timeframe(timeframe)
        parsed_symbols = parse_symbol_list(symbols) if symbols else None
        if parsed_symbols:
            parsed_symbols = [validate_symbol(symbol) for symbol in parsed_symbols]
        tickers = fetch_24h_tickers(parsed_symbols, top_n if not parsed_symbols else None)
        results = []
        for ticker in tickers:
            symbol = str(ticker.get("symbol", "")).upper()
            item = {
                "symbol": symbol,
                "lastPrice": safe_float(ticker.get("lastPrice"), 6),
                "priceChangePercent": safe_float(ticker.get("priceChangePercent"), 4),
                "volume": safe_float(ticker.get("volume"), 4),
                "quoteVolume": safe_float(ticker.get("quoteVolume"), 2),
                "highPrice": safe_float(ticker.get("highPrice"), 6),
                "lowPrice": safe_float(ticker.get("lowPrice"), 6),
            }
            if with_indicators and symbol:
                try:
                    item["indicators"] = last_indicators_snapshot(symbol, timeframe)
                except Exception as exc:
                    item["indicators_error"] = str(exc)
            results.append(item)
        return {"ok": True, "count": len(results), "data": json_sanitize(results)}
    except HTTPException as exc:
        return JSONResponse(status_code=200, content={"ok": False, "error": str(exc.detail), "code": exc.status_code})


@app.get("/signals/batch")
def signals_batch(symbols: str, timeframe: str = "1h"):
    timeframe = validate_timeframe(timeframe)
    parsed_symbols = [validate_symbol(symbol) for symbol in parse_symbol_list(symbols)]
    if not parsed_symbols:
        raise HTTPException(400, "symbols must be non-empty")
    results = []
    for symbol in parsed_symbols[:25]:
        try:
            results.append({"symbol": symbol, "data": compute_analysis(symbol, timeframe)})
        except HTTPException as exc:
            results.append({"symbol": symbol, "error": str(exc.detail), "status": exc.status_code})
        except Exception as exc:
            results.append({"symbol": symbol, "error": str(exc)})
    return json_sanitize({"ok": True, "count": len(results), "results": results})


@app.get("/readiness")
def readiness(symbol: str = "BTCUSDT", timeframe: str = "1h"):
    try:
        symbol = validate_symbol(symbol)
        timeframe = validate_timeframe(timeframe)
        df = fetch_ohlcv(symbol, timeframe, MIN_CANDLES_REQUIRED)
        return {"ok": bool(len(df) >= 200), "rows": int(len(df))}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
