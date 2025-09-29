# signal_api.py
from __future__ import annotations

import math

def safe_num(x, ndigits=None):
    try:
        v = float(x)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, ndigits) if ndigits is not None else v

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

import os
from typing import Iterable, Tuple

import requests
from fastapi import FastAPI, HTTPException
import pandas as pd
import numpy as np
import ta
import logging
import traceback

app = FastAPI()

# --- basic logger setup ---
logger = logging.getLogger("ai-service")
if not logger.handlers:
    handler = logging.StreamHandler()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler.setFormatter(fmt)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


# Lightweight root and health endpoints
@app.get("/")
def root():
    return {"ok": True, "service": "ai-service"}

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

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
    return requests.get(url, timeout=10)


def fetch_ohlcv(symbol="BTCUSDT", interval="15m", limit=300):
    errors = []
    for base, path in DATA_SOURCES:
        try:
            resp = _request_klines(base, path, symbol=symbol, interval=interval, limit=limit)
        except requests.RequestException as exc:
            errors.append(f"{base}{path}: request failed ({exc})")
            continue

        if resp.status_code != 200:
            errors.append(f"{base}{path}: status {resp.status_code} {resp.text[:120]}")
            continue

        try:
            data = resp.json()
        except ValueError as exc:
            errors.append(f"{base}{path}: invalid json ({exc})")
            continue

        if not data:
            errors.append(f"{base}{path}: empty klines")
            continue

        cols = ["time","open","high","low","close","volume","ct","qv","n","tb","tq","ig"]
        df = pd.DataFrame(data, columns=cols)
        for col in ["open","high","low","close","volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df["symbol"] = symbol

        # Basic sanity: drop fully empty rows and ensure enough bars for indicators
        df = df.dropna(subset=["open","high","low","close"]).copy()
        if len(df) < 60:  # need enough for EMA26/BB20/ADX14 + margins
            errors.append(f"{base}{path}: insufficient rows ({len(df)})")
            continue

        return df

    raise HTTPException(502, "all data providers failed: " + " | ".join(errors))

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

    return df


def prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["open_time"] = pd.to_datetime(result["time"], unit="ms")
    for col in ["open", "high", "low", "close", "volume"]:
        result[col] = pd.to_numeric(result[col], errors="coerce")
    result = result.set_index("open_time").sort_index()
    return add_indicators(result)


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
    for frame, name in ((base, "15m"), (h1, "1h"), (h4, "4h")):
        if len(frame) < 60:
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

    return {
        "symbol": symbol,
        "side": side,
        "score": float(round(score, 2)),
        "price": price, "rsi": rsi, "atr": atr,
        "ema_fast": emaf, "ema_slow": emas, "atr_pct": atrp, "adx": adx,
        "sl": sl, "tp": tp,
        "mtf": {
            "votes": {"base15m": v_base, "h1": v_h1, "h4": v_h4},
            "filters": {"adx_ok": adx_ok, "vol_ok": vol_ok}
        }
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
):
    if signals is None:
        signals = generate_signal_history(symbol, limit)
    signals["fwd_return"] = signals["close"].shift(-horizon) / signals["close"] - 1
    active = signals[(signals["side"].isin(["BUY", "SELL"])) & (signals["score"] >= threshold)].copy()
    active = active.dropna(subset=["fwd_return"])
    active["direction"] = active["side"].map({"BUY": 1, "SELL": -1})
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

@app.post("/predict")
def predict(payload: dict):
    symbol = payload.get("symbol", "BTCUSDT")
    try:
        res = compute_signal(symbol)
        return json_sanitize(res)
    except HTTPException as he:
        # propagate FastAPI HTTP errors (e.g., 502/503) as-is
        raise he
    except Exception as exc:
        logger.error("/predict failed for %s: %s\n%s", symbol, exc, traceback.format_exc())
        raise HTTPException(500, "internal error while computing signal; check server logs")


@app.get("/backtest")
def backtest(
    symbol: str = "BTCUSDT",
    threshold: float = 0.6,
    limit: int = 400,
    horizon: int = 4,
    commission_bps: float = 4.0,
    slippage_bps: float = 1.0,
    position_size: float = 1.0,
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
