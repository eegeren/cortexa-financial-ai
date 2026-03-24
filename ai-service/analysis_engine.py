from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
import ta


DISCLAIMER = "This is not financial advice. It is an informational market analysis."
CORE_COLUMNS = ("open", "high", "low", "close", "volume")
HIGH_QUALITY_SYMBOLS = frozenset({"BTCUSDT", "ETHUSDT"})
MID_QUALITY_SYMBOLS = frozenset({"SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT", "AVAXUSDT"})

PROFILE_RULES: dict[str, dict[str, float | int | bool]] = {
    "high_quality": {
        "neutral_adx_min": 22,
        "neutral_volume_min": 0.85,
        "directional_adx_min": 22,
        "directional_volume_min": 0.95,
        "directional_confirmations_min": 4,
        "directional_mtf_required": False,
        "directional_confidence_min": 45,
        "strong_adx_min": 25,
        "strong_volume_min": 1.0,
        "strong_confirmations_min": 5,
        "strong_confidence_min": 75,
    },
    "mid_quality": {
        "neutral_adx_min": 23,
        "neutral_volume_min": 0.90,
        "directional_adx_min": 23,
        "directional_volume_min": 1.0,
        "directional_confirmations_min": 5,
        "directional_mtf_required": False,
        "directional_confidence_min": 45,
        "strong_adx_min": 27,
        "strong_volume_min": 1.08,
        "strong_confirmations_min": 6,
        "strong_confidence_min": 76,
    },
    "low_quality": {
        "neutral_adx_min": 25,
        "neutral_volume_min": 0.95,
        "directional_adx_min": 25,
        "directional_volume_min": 1.05,
        "directional_confirmations_min": 5,
        "directional_mtf_required": True,
        "directional_confidence_min": 60,
        "strong_adx_min": 30,
        "strong_volume_min": 1.15,
        "strong_confirmations_min": 6,
        "strong_confidence_min": 78,
    },
}
REGIME_LABELS = {
    "TRENDING": "Trending",
    "LOW_PARTICIPATION": "Low Participation",
    "RANGE": "Range-Bound",
}


@dataclass(frozen=True)
class SupportResistanceLevels:
    support: float | None
    resistance: float | None


def safe_float(value: Any, digits: int | None = None) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(number):
        return None
    return round(number, digits) if digits is not None else number


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def confidence_from_raw_score(raw_score: float) -> int:
    # Keep the midpoint anchored while compressing extremes and lifting the
    # practical floor so weak bearish structure still has usable separation.
    adjusted = 50.0 + ((raw_score - 50.0) * 0.68)
    return int(round(clamp(adjusted, 16.0, 90.0)))


def normalize_timeframe(timeframe: str | None) -> str:
    value = (timeframe or "1h").strip().lower()
    return value or "1h"


def coin_profile(symbol: str | None) -> str:
    normalized = (symbol or "").strip().upper()
    if normalized in HIGH_QUALITY_SYMBOLS:
        return "high_quality"
    if normalized in MID_QUALITY_SYMBOLS:
        return "mid_quality"
    return "low_quality"


def coin_profile_rules(symbol: str | None) -> dict[str, float | int | bool]:
    return dict(PROFILE_RULES[coin_profile(symbol)])


def detect_regime(adx: float | None, volume_ratio: float | None) -> str:
    if adx is not None and adx > 25:
        return "TRENDING"
    if volume_ratio is not None and volume_ratio < 0.8:
        return "LOW_PARTICIPATION"
    return "RANGE"


def should_emit_signal(confidence: int, quality_flags: list[str]) -> bool:
    flags = set(quality_flags)
    if confidence < 25:
        return False
    if "low_volume" in flags:
        return False
    if "choppy_structure" in flags:
        return False
    return True


def build_indicator_frame(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    if "open_time" in frame.columns:
        frame["open_time"] = pd.to_datetime(frame["open_time"])
        frame = frame.set_index("open_time")
    elif "time" in frame.columns:
        frame["open_time"] = pd.to_datetime(frame["time"], unit="ms")
        frame = frame.set_index("open_time")
    frame = frame.sort_index()

    for column in CORE_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame.dropna(subset=["high", "low", "close"]).copy()
    frame["volume"] = frame["volume"].fillna(0.0)

    frame["ema20"] = ta.trend.EMAIndicator(close=frame["close"], window=20).ema_indicator()
    frame["ema50"] = ta.trend.EMAIndicator(close=frame["close"], window=50).ema_indicator()
    frame["ema200"] = ta.trend.EMAIndicator(close=frame["close"], window=200).ema_indicator()

    macd = ta.trend.MACD(close=frame["close"], window_fast=12, window_slow=26, window_sign=9)
    frame["macd"] = macd.macd()
    frame["macd_signal"] = macd.macd_signal()
    frame["macd_histogram"] = macd.macd_diff()

    frame["rsi"] = ta.momentum.RSIIndicator(close=frame["close"], window=14).rsi()
    adx = ta.trend.ADXIndicator(high=frame["high"], low=frame["low"], close=frame["close"], window=14)
    frame["adx"] = adx.adx()

    atr = ta.volatility.AverageTrueRange(high=frame["high"], low=frame["low"], close=frame["close"], window=14)
    frame["atr"] = atr.average_true_range()
    frame["atr_pct"] = (frame["atr"] / frame["close"]).replace([np.inf, -np.inf], np.nan)

    frame["volume_avg"] = frame["volume"].rolling(window=20, min_periods=20).mean()
    frame["volume_ratio"] = (frame["volume"] / frame["volume_avg"]).replace([np.inf, -np.inf], np.nan)
    return frame


def _nearest_level(levels: list[float], current_price: float, *, prefer_below: bool) -> float | None:
    if prefer_below:
        candidates = [level for level in levels if level < current_price]
        return max(candidates) if candidates else None
    candidates = [level for level in levels if level > current_price]
    return min(candidates) if candidates else None


def detect_support_resistance(frame: pd.DataFrame, lookback: int = 60, pivot_window: int = 2) -> SupportResistanceLevels:
    window = frame.tail(max(lookback, 10)).copy()
    if window.empty:
        return SupportResistanceLevels(support=None, resistance=None)

    current_price = safe_float(window["close"].iloc[-1])
    if current_price is None:
        return SupportResistanceLevels(support=None, resistance=None)

    lows = window["low"].reset_index(drop=True)
    highs = window["high"].reset_index(drop=True)
    swing_lows: list[float] = []
    swing_highs: list[float] = []

    for index in range(pivot_window, len(window) - pivot_window):
        low_value = lows.iloc[index]
        high_value = highs.iloc[index]
        low_slice = lows.iloc[index - pivot_window:index + pivot_window + 1]
        high_slice = highs.iloc[index - pivot_window:index + pivot_window + 1]
        if low_value == low_slice.min():
            swing_lows.append(float(low_value))
        if high_value == high_slice.max():
            swing_highs.append(float(high_value))

    if not swing_lows:
        swing_lows = [float(window["low"].tail(20).min())]
    if not swing_highs:
        swing_highs = [float(window["high"].tail(20).max())]

    support = _nearest_level(swing_lows, current_price, prefer_below=True)
    resistance = _nearest_level(swing_highs, current_price, prefer_below=False)

    if support is None:
        support = safe_float(window["low"].tail(20).min())
    if resistance is None:
        resistance = safe_float(window["high"].tail(20).max())

    return SupportResistanceLevels(
        support=safe_float(support, 2),
        resistance=safe_float(resistance, 2),
    )


def _trend_signal_strength(ema20: float | None, ema50: float | None, ema200: float | None, price: float | None) -> float:
    signal = 0.0
    if ema20 is not None and ema50 is not None:
        signal += 0.35 if ema20 > ema50 else -0.35
    if ema50 is not None and ema200 is not None:
        signal += 0.35 if ema50 > ema200 else -0.35
    if price is not None and ema20 is not None:
        signal += 0.15 if price > ema20 else -0.15
    if price is not None and ema200 is not None:
        signal += 0.15 if price > ema200 else -0.15
    return clamp(signal, -1.0, 1.0)


def _macd_signal_strength(macd: float | None, macd_signal: float | None, macd_histogram: float | None) -> float:
    if macd is None or macd_signal is None or macd_histogram is None:
        return 0.0
    signal = 0.0
    signal += 0.6 if macd > macd_signal else -0.6
    signal += 0.4 if macd_histogram > 0 else -0.4
    return clamp(signal, -1.0, 1.0)


def _rsi_signal_strength(rsi: float | None, regime: str) -> float:
    if rsi is None:
        return 0.0
    if regime == "TRENDING":
        if 55 <= rsi <= 68:
            return 0.35
        if 32 <= rsi <= 45:
            return -0.35
        if rsi > 72:
            return -0.25
        if rsi < 28:
            return 0.25
        return 0.0
    if regime == "RANGE":
        if 58 <= rsi <= 70:
            return 0.8
        if 30 <= rsi <= 42:
            return -0.8
        return 0.0
    if 55 <= rsi <= 68:
        return 0.2
    if 32 <= rsi <= 45:
        return -0.2
    return 0.0


def _volume_component_score(volume_ratio: float | None, *, trend_is_strong: bool) -> tuple[float, int]:
    if volume_ratio is None:
        return -4.0, -1
    if volume_ratio > 1.2 and trend_is_strong:
        return 10.0, 1
    if volume_ratio >= 1.0:
        return 6.0, 1
    if volume_ratio < 0.7:
        return -10.0, -1
    if volume_ratio < 0.8:
        return -6.0, -1
    return 0.0, 0


def score_row(row: pd.Series) -> dict[str, Any]:
    ema20 = safe_float(row.get("ema20"))
    ema50 = safe_float(row.get("ema50"))
    ema200 = safe_float(row.get("ema200"))
    price = safe_float(row.get("close"))
    rsi = safe_float(row.get("rsi"))
    macd = safe_float(row.get("macd"))
    macd_signal = safe_float(row.get("macd_signal"))
    macd_histogram = safe_float(row.get("macd_histogram"))
    adx = safe_float(row.get("adx"))
    atr_pct = safe_float(row.get("atr_pct"))
    volume_ratio = safe_float(row.get("volume_ratio"))
    regime = detect_regime(adx, volume_ratio)
    trend_signal = _trend_signal_strength(ema20, ema50, ema200, price)
    momentum_signal = _macd_signal_strength(macd, macd_signal, macd_histogram)
    rsi_signal = _rsi_signal_strength(rsi, regime)
    trend_is_strong = adx is not None and adx >= 25 and abs(trend_signal) >= 0.65

    if regime == "TRENDING":
        trend_weight = 28.0
        momentum_weight = 12.0
        rsi_weight = 4.0
    elif regime == "RANGE":
        trend_weight = 12.0
        momentum_weight = 10.0
        rsi_weight = 18.0
    else:
        trend_weight = 16.0
        momentum_weight = 8.0
        rsi_weight = 6.0

    trend_points = int(round(trend_signal * trend_weight))
    momentum_points = int(round((momentum_signal * momentum_weight) + (rsi_signal * rsi_weight)))

    if adx is not None and adx >= 30:
        strength_points = 8
    elif adx is not None and adx >= 25:
        strength_points = 4
    elif adx is not None and adx < 18:
        strength_points = -10
    else:
        strength_points = -4 if regime == "LOW_PARTICIPATION" else 0

    volume_raw, volume_direction = _volume_component_score(volume_ratio, trend_is_strong=trend_is_strong)
    volume_points = int(round(volume_raw * max(abs(trend_signal), 0.65))) if volume_direction != 0 else int(round(volume_raw))

    risk_adjustment = 0
    if atr_pct is not None:
        if atr_pct >= 0.07:
            risk_adjustment -= 14
        elif atr_pct >= 0.05:
            risk_adjustment -= 8
        elif atr_pct <= 0.025:
            risk_adjustment += 3
    if regime == "LOW_PARTICIPATION":
        risk_adjustment -= 8

    score = 50.0 + trend_points + momentum_points + strength_points + volume_points + risk_adjustment
    confidence = confidence_from_raw_score(score)

    return {
        "confidence": confidence,
        "trend_points": trend_points,
        "momentum_points": momentum_points,
        "strength_points": strength_points,
        "volume_points": volume_points,
        "risk_adjustment": risk_adjustment,
        "raw_score": score,
        "reversal_context": bool(rsi is not None and (rsi < 30 or rsi > 70)),
        "regime": regime,
        "trend_score": int(round(abs(trend_signal) * 40)),
        "momentum_score": int(round(min(20.0, abs(momentum_signal * momentum_weight) + abs(rsi_signal * rsi_weight)))),
        "volume_score": int(round(min(20.0, abs(volume_raw)))),
        "mtf_score": 0,
    }


def trend_label(confidence: int) -> str:
    if confidence <= 16:
        return "Strong Bearish"
    if confidence <= 40:
        return "Bearish"
    if confidence <= 58:
        return "Neutral"
    if confidence <= 78:
        return "Bullish"
    return "Strong Bullish"


def trend_bias(trend: str) -> int:
    if trend == "Strong Bullish":
        return 2
    if trend == "Bullish":
        return 1
    if trend == "Strong Bearish":
        return -2
    if trend == "Bearish":
        return -1
    return 0


def _dedupe_flags(flags: list[str]) -> list[str]:
    return list(dict.fromkeys(flags))


def apply_quality_first_signal_filter(
    analysis: dict[str, Any],
    latest_row: pd.Series,
    *,
    timeframe: str | None = None,
    stale: bool,
    higher_timeframe_trend: str | None = None,
    higher_timeframe_stale: bool = False,
) -> dict[str, Any]:
    updated = {
        **analysis,
        "scoring": dict(analysis.get("scoring", {})),
        "quality_flags": list(analysis.get("quality_flags", [])),
    }

    symbol = str(updated.get("symbol") or analysis.get("symbol") or "")
    profile = coin_profile(symbol)
    rules = coin_profile_rules(symbol)
    confidence = int(updated["confidence"])
    flags = list(updated["quality_flags"])
    market_quality_adjustment = 0
    mtf_adjustment = 0

    ema20 = safe_float(latest_row.get("ema20"))
    ema50 = safe_float(latest_row.get("ema50"))
    ema200 = safe_float(latest_row.get("ema200"))
    price = safe_float(latest_row.get("close"))
    rsi = safe_float(latest_row.get("rsi"))
    macd = safe_float(latest_row.get("macd"))
    macd_signal = safe_float(latest_row.get("macd_signal"))
    macd_histogram = safe_float(latest_row.get("macd_histogram"))
    adx = safe_float(latest_row.get("adx"))
    volume_ratio = safe_float(latest_row.get("volume_ratio"))
    regime = str(updated.get("market_regime", "Range-Bound"))
    risk = str(updated.get("risk", "Medium"))

    bullish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 > ema50 > ema200
    bearish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 < ema50 < ema200
    choppy_structure = not bullish_stack and not bearish_stack and adx is not None and adx < 25

    if stale:
        market_quality_adjustment -= 8
        flags.append("stale_data")

    if higher_timeframe_stale:
        market_quality_adjustment -= 1

    directional_volume_min = float(rules["directional_volume_min"])
    neutral_volume_min = float(rules["neutral_volume_min"])
    neutral_adx_min = float(rules["neutral_adx_min"])

    if volume_ratio is not None and volume_ratio < directional_volume_min:
        market_quality_adjustment -= 3
        flags.append("weak_volume_confirmation")
    if volume_ratio is not None and volume_ratio < neutral_volume_min:
        market_quality_adjustment -= 7
        flags.append("low_volume")

    if adx is not None and adx < neutral_adx_min:
        market_quality_adjustment -= 10
        flags.append("weak_trend_strength")
    elif adx is not None and adx < 25:
        market_quality_adjustment -= 4

    if regime in {"Range-Bound", "Low Participation"}:
        market_quality_adjustment -= 8
        flags.append("choppy_structure")
    elif choppy_structure:
        market_quality_adjustment -= 4
        flags.append("choppy_structure")

    higher_is_bullish = higher_timeframe_trend in {"Bullish", "Strong Bullish"}
    higher_is_bearish = higher_timeframe_trend in {"Bearish", "Strong Bearish"}

    bullish_confirmations = 0
    bearish_confirmations = 0

    if ema20 is not None and ema50 is not None and ema20 > ema50:
        bullish_confirmations += 1
    if ema50 is not None and ema200 is not None and ema50 > ema200:
        bullish_confirmations += 1
    if price is not None and ema20 is not None and price > ema20:
        bullish_confirmations += 1
    if macd is not None and macd_signal is not None and macd > macd_signal:
        bullish_confirmations += 1
    if macd_histogram is not None and macd_histogram > 0:
        bullish_confirmations += 1
    if rsi is not None and 52 <= rsi <= 68:
        bullish_confirmations += 1
    if higher_is_bullish:
        bullish_confirmations += 1
    if volume_ratio is not None and volume_ratio >= directional_volume_min:
        bullish_confirmations += 1

    if ema20 is not None and ema50 is not None and ema20 < ema50:
        bearish_confirmations += 1
    if ema50 is not None and ema200 is not None and ema50 < ema200:
        bearish_confirmations += 1
    if price is not None and ema20 is not None and price < ema20:
        bearish_confirmations += 1
    if macd is not None and macd_signal is not None and macd < macd_signal:
        bearish_confirmations += 1
    if macd_histogram is not None and macd_histogram < 0:
        bearish_confirmations += 1
    if rsi is not None and 32 <= rsi <= 48:
        bearish_confirmations += 1
    if higher_is_bearish:
        bearish_confirmations += 1
    if volume_ratio is not None and volume_ratio >= directional_volume_min:
        bearish_confirmations += 1

    if higher_is_bullish and bearish_confirmations > bullish_confirmations:
        mtf_adjustment -= 10
        flags.append("mtf_conflict")
    elif higher_is_bearish and bullish_confirmations > bearish_confirmations:
        mtf_adjustment -= 10
        flags.append("mtf_conflict")
    elif higher_is_bullish and bullish_confirmations >= bearish_confirmations and bullish_confirmations >= 4:
        mtf_adjustment += 10
        flags.append("mtf_aligned")
    elif higher_is_bearish and bearish_confirmations >= bullish_confirmations and bearish_confirmations >= 4:
        mtf_adjustment += 10
        flags.append("mtf_aligned")

    trend_is_strong = (
        adx is not None
        and adx >= 25
        and ((bullish_stack and bullish_confirmations >= 5) or (bearish_stack and bearish_confirmations >= 5))
    )
    if volume_ratio is not None and volume_ratio > 1.2 and trend_is_strong:
        market_quality_adjustment += 10
    elif volume_ratio is not None and volume_ratio < 0.7:
        market_quality_adjustment -= 10

    confidence = int(round(max(16, min(90, confidence + market_quality_adjustment + mtf_adjustment))))
    flags = _dedupe_flags(flags)

    bullish_exhausted = rsi is not None and rsi > 72
    bearish_exhausted = rsi is not None and rsi < 28
    directional_adx_min = float(rules["directional_adx_min"])
    directional_confirmations_min = int(rules["directional_confirmations_min"])
    directional_mtf_required = bool(rules["directional_mtf_required"])
    directional_confidence_min = int(rules["directional_confidence_min"])
    strong_adx_min = float(rules["strong_adx_min"])
    strong_volume_min = float(rules["strong_volume_min"])
    strong_confirmations_min = int(rules["strong_confirmations_min"])
    strong_confidence_min = int(rules["strong_confidence_min"])
    no_trade = (
        (adx is not None and adx < neutral_adx_min)
        or (volume_ratio is not None and volume_ratio < neutral_volume_min)
        or regime in {"Range-Bound", "Low Participation"}
        or "mtf_conflict" in flags
        or "choppy_structure" in flags
        or "weak_trend_strength" in flags
    )

    bull_price_confirms = price is not None and ema20 is not None and price > ema20
    bear_price_confirms = price is not None and ema20 is not None and price < ema20
    bull_macd_confirms = (
        macd is not None
        and macd_signal is not None
        and macd > macd_signal
        and macd_histogram is not None
        and macd_histogram > 0
    )
    bear_macd_confirms = (
        macd is not None
        and macd_signal is not None
        and macd < macd_signal
        and macd_histogram is not None
        and macd_histogram < 0
    )
    bull_rsi_supportive = rsi is not None and 52 <= rsi <= 68
    bear_rsi_supportive = rsi is not None and 32 <= rsi <= 48
    mtf_aligned = "mtf_aligned" in flags

    bull_candidate = (
        bullish_confirmations >= directional_confirmations_min
        and not bullish_exhausted
        and bull_price_confirms
        and bull_macd_confirms
        and adx is not None
        and adx >= directional_adx_min
        and volume_ratio is not None
        and volume_ratio >= directional_volume_min
        and (not directional_mtf_required or mtf_aligned)
    )
    bear_candidate = (
        bearish_confirmations >= directional_confirmations_min
        and not bearish_exhausted
        and bear_price_confirms
        and bear_macd_confirms
        and adx is not None
        and adx >= directional_adx_min
        and volume_ratio is not None
        and volume_ratio >= directional_volume_min
        and (not directional_mtf_required or mtf_aligned)
    )
    bull_strong_ready = (
        bull_candidate
        and bullish_stack
        and bullish_confirmations >= strong_confirmations_min
        and bull_rsi_supportive
        and adx is not None
        and adx >= strong_adx_min
        and volume_ratio is not None
        and volume_ratio >= strong_volume_min
        and mtf_aligned
        and confidence >= strong_confidence_min
    )
    bear_strong_ready = (
        bear_candidate
        and bearish_stack
        and bearish_confirmations >= strong_confirmations_min
        and bear_rsi_supportive
        and adx is not None
        and adx >= strong_adx_min
        and volume_ratio is not None
        and volume_ratio >= strong_volume_min
        and mtf_aligned
        and confidence >= strong_confidence_min
    )

    trend = "Neutral"
    if not no_trade and confidence >= directional_confidence_min and not (risk == "High" and confidence < 65):
        if bull_candidate and bullish_confirmations > bearish_confirmations:
            trend = "Bullish"
        elif bear_candidate and bearish_confirmations > bullish_confirmations:
            trend = "Bearish"

    if confidence < 45:
        trend = "Neutral"
    if risk == "High" and confidence < 65:
        trend = "Neutral"
    if bullish_exhausted and trend in {"Bullish", "Strong Bullish"}:
        trend = "Neutral"
    if bearish_exhausted and trend in {"Bearish", "Strong Bearish"}:
        trend = "Neutral"
    if not should_emit_signal(confidence, flags):
        trend = "Neutral"
    if confidence < 30:
        trend = "Neutral"

    updated["confidence"] = confidence
    updated["trend"] = trend
    updated["quality_flags"] = flags
    updated["stale"] = stale
    updated["coin_profile"] = profile
    updated["scoring"]["market_quality"] = market_quality_adjustment
    updated["scoring"]["multi_timeframe_confirmation"] = mtf_adjustment
    updated["scoring"]["mtf_score"] = abs(mtf_adjustment)
    updated["scoring"]["bullish_confirmations"] = bullish_confirmations
    updated["scoring"]["bearish_confirmations"] = bearish_confirmations
    updated["scoring"]["bull_strong_ready"] = bull_strong_ready
    updated["scoring"]["bear_strong_ready"] = bear_strong_ready
    updated["scoring"]["coin_profile"] = profile

    if trend == "Neutral" and risk == "Low" and confidence < 65:
        updated["risk"] = "Medium"
    else:
        updated["risk"] = risk

    updated["scenario"] = scenario_summary(
        trend=updated["trend"],
        price=updated.get("price"),
        support=updated.get("levels", {}).get("support"),
        resistance=updated.get("levels", {}).get("resistance"),
        regime=str(updated.get("market_regime", "Range-Bound")),
        momentum=str(updated.get("momentum", "Weak")),
    )

    return updated


def deterministic_ai_validation_proxy(analysis: dict[str, Any]) -> dict[str, Any]:
    trend = str(analysis.get("trend", "Neutral"))
    confidence = int(analysis.get("confidence", 50))
    risk = str(analysis.get("risk", "Medium"))
    regime = str(analysis.get("market_regime", "Range-Bound"))
    flags = set(str(flag) for flag in analysis.get("quality_flags", []) if flag)
    indicators = analysis.get("indicators", {}) or {}
    scoring = analysis.get("scoring", {}) or {}

    adx = safe_float(indicators.get("adx"))
    volume_ratio = safe_float(indicators.get("volume_ratio"))
    rsi = safe_float(indicators.get("rsi"))
    macd_payload = indicators.get("macd", {}) or {}
    macd = safe_float(macd_payload.get("macd"))
    macd_signal = safe_float(macd_payload.get("signal"))
    macd_histogram = safe_float(macd_payload.get("histogram"))
    ema20 = safe_float(indicators.get("ema20"))
    ema50 = safe_float(indicators.get("ema50"))
    ema200 = safe_float(indicators.get("ema200"))
    price = safe_float(analysis.get("price"))

    bullish_direction = trend in {"Bullish", "Strong Bullish"}
    bearish_direction = trend in {"Bearish", "Strong Bearish"}
    bullish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 > ema50 > ema200
    bearish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 < ema50 < ema200
    price_confirms = (
        (bullish_direction and price is not None and ema20 is not None and price > ema20)
        or (bearish_direction and price is not None and ema20 is not None and price < ema20)
    )
    macd_confirms = (
        bullish_direction
        and macd is not None
        and macd_signal is not None
        and macd > macd_signal
        and macd_histogram is not None
        and macd_histogram > 0
    ) or (
        bearish_direction
        and macd is not None
        and macd_signal is not None
        and macd < macd_signal
        and macd_histogram is not None
        and macd_histogram < 0
    )
    supportive_rsi = (
        bullish_direction and rsi is not None and 52 <= rsi <= 68
    ) or (
        bearish_direction and rsi is not None and 32 <= rsi <= 48
    )

    confirmation_count = int(
        scoring.get("bullish_confirmations", 0) if bullish_direction else scoring.get("bearish_confirmations", 0)
    )
    has_conflict = bool({"mtf_conflict", "choppy_structure", "weak_trend_strength"} & flags)
    directional = bullish_direction or bearish_direction
    clean_structure = bullish_stack or bearish_stack

    if not directional:
        return {
            "valid_setup": True,
            "setup_quality": "low",
            "confidence_adjustment": -4,
            "reason": "Directional alignment is insufficient, so no clear edge is present.",
        }

    if (
        has_conflict
        or regime in {"Range-Bound", "Low Participation"}
        or volume_ratio is None
        or volume_ratio < 0.95
        or adx is None
        or adx < 22
        or confidence < 45
        or (risk == "High" and confidence < 65)
        or not price_confirms
        or not macd_confirms
    ):
        return {
            "valid_setup": False,
            "setup_quality": "low",
            "confidence_adjustment": -8,
            "reason": "Participation or confirmation is too weak to keep a reliable directional setup.",
        }

    if (
        clean_structure
        and supportive_rsi
        and volume_ratio >= 1.0
        and adx >= 25
        and "mtf_aligned" in flags
        and confirmation_count >= 5
        and confidence >= 75
    ):
        return {
            "valid_setup": True,
            "setup_quality": "high",
            "confidence_adjustment": 3,
            "reason": "Structure, momentum, participation, and timeframe alignment are all clean and supportive.",
        }

    return {
        "valid_setup": True,
        "setup_quality": "medium",
        "confidence_adjustment": 0,
        "reason": "The setup is usable, but confirmation quality is not clean enough to rate highly.",
    }


def apply_ai_validation_outcome(analysis: dict[str, Any], ai_validation: dict[str, Any]) -> dict[str, Any]:
    updated = {
        **analysis,
        "scoring": dict(analysis.get("scoring", {})),
        "quality_flags": list(analysis.get("quality_flags", [])),
    }

    setup_quality = ai_validation.get("setup_quality")
    valid_setup = ai_validation.get("valid_setup")
    confidence_adjustment = int(ai_validation.get("confidence_adjustment", 0))
    updated["ai_validated"] = valid_setup
    updated["ai_setup_quality"] = setup_quality
    updated["ai_validation_reason"] = str(ai_validation.get("reason", "")).strip()
    updated["ai_confidence_adjustment"] = confidence_adjustment

    confidence = int(updated.get("confidence", 50))
    if setup_quality == "low" or valid_setup is False:
        updated["trend"] = "Neutral"
        updated["confidence"] = max(16, min(42, confidence + confidence_adjustment))
        return updated

    updated["confidence"] = max(16, min(90, confidence + confidence_adjustment))
    if setup_quality == "high" and valid_setup is True:
        bull_ready = bool(updated.get("scoring", {}).get("bull_strong_ready"))
        bear_ready = bool(updated.get("scoring", {}).get("bear_strong_ready"))
        current_trend = str(updated.get("trend", "Neutral"))
        if bull_ready and current_trend == "Bullish" and int(updated["confidence"]) >= 75:
            updated["trend"] = "Strong Bullish"
        elif bear_ready and current_trend == "Bearish" and int(updated["confidence"]) >= 75:
            updated["trend"] = "Strong Bearish"
    return updated


def momentum_label(row: pd.Series, scoring: dict[str, Any]) -> str:
    rsi = safe_float(row.get("rsi"))
    macd = safe_float(row.get("macd"))
    macd_signal = safe_float(row.get("macd_signal"))
    strength = scoring["momentum_points"]

    if strength >= 20:
        return "Strong"
    if strength >= 10:
        return "Moderate"
    if rsi is not None and rsi < 40 and macd is not None and macd_signal is not None and macd < macd_signal:
        return "Weak"
    return "Moderate" if strength > 0 else "Weak"


def risk_label(row: pd.Series) -> str:
    atr_pct = safe_float(row.get("atr_pct"))
    adx = safe_float(row.get("adx"))
    volume_ratio = safe_float(row.get("volume_ratio"))
    ema20 = safe_float(row.get("ema20"))
    ema50 = safe_float(row.get("ema50"))
    ema200 = safe_float(row.get("ema200"))
    price = safe_float(row.get("close"))

    bullish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 > ema50 > ema200
    bearish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 < ema50 < ema200
    aligned_structure = bullish_stack or bearish_stack
    trend_side_confirmed = (
        price is not None
        and ema200 is not None
        and ((bullish_stack and price >= ema200) or (bearish_stack and price <= ema200))
    )

    if atr_pct is None:
        return "Medium"
    if atr_pct >= 0.075:
        return "High"
    if volume_ratio is not None and volume_ratio < 0.58:
        return "High"
    if adx is not None and adx < 15:
        return "High"
    if not aligned_structure and ((adx is not None and adx < 18) or (volume_ratio is not None and volume_ratio < 0.72)):
        return "High"
    if (
        atr_pct <= 0.018
        and (adx is None or adx >= 25)
        and (volume_ratio is None or volume_ratio >= 0.95)
        and aligned_structure
        and trend_side_confirmed
    ):
        return "Low"
    if volume_ratio is not None and volume_ratio < 0.82:
        return "Medium"
    if adx is not None and adx < 20:
        return "Medium"
    return "Medium"


def market_regime(row: pd.Series) -> str:
    adx = safe_float(row.get("adx"))
    volume_ratio = safe_float(row.get("volume_ratio"))
    return REGIME_LABELS[detect_regime(adx, volume_ratio)]


def scenario_summary(
    *,
    trend: str,
    price: float | None,
    support: float | None,
    resistance: float | None,
    regime: str,
    momentum: str,
) -> str:
    if price is None:
        return "Market structure is unavailable because the latest price data is incomplete."

    if trend in {"Bullish", "Strong Bullish"}:
        base = "Price is holding above major moving averages with constructive momentum."
        continuation = (
            f" A break above {resistance:.2f} would support continuation"
            if resistance is not None
            else " Further acceptance above recent highs would support continuation"
        )
        pullback = (
            f", while a rejection could retest support near {support:.2f}."
            if support is not None
            else ", while rejection could lead to a retracement into prior support."
        )
        return base + continuation + pullback

    if trend in {"Bearish", "Strong Bearish"}:
        base = "Price is trading below its higher-timeframe trend anchors and momentum remains fragile."
        downside = (
            f" Sustained weakness below {support:.2f} would keep downside pressure in focus"
            if support is not None
            else " Continued failure at recent lows would keep downside pressure in focus"
        )
        rebound = (
            f", while recovery above {resistance:.2f} would weaken the bearish structure."
            if resistance is not None
            else ", while recovery through recent highs would weaken the bearish structure."
        )
        return base + downside + rebound

    return (
        f"The market is currently {regime.lower()} with {momentum.lower()} momentum. "
        "A decisive move away from the current range is needed before structure becomes directional."
    )


def build_indicator_snapshot(row: pd.Series) -> dict[str, Any]:
    return {
        "ema20": safe_float(row.get("ema20"), 2),
        "ema50": safe_float(row.get("ema50"), 2),
        "ema200": safe_float(row.get("ema200"), 2),
        "rsi": safe_float(row.get("rsi"), 2),
        "macd": {
            "macd": safe_float(row.get("macd"), 4),
            "signal": safe_float(row.get("macd_signal"), 4),
            "histogram": safe_float(row.get("macd_histogram"), 4),
        },
        "adx": safe_float(row.get("adx"), 2),
        "atr": safe_float(row.get("atr"), 4),
        "volume_ratio": safe_float(row.get("volume_ratio"), 2),
    }


def build_analysis(
    frame: pd.DataFrame,
    *,
    symbol: str,
    timeframe: str,
    explanation: str | None = None,
) -> dict[str, Any]:
    if frame.empty:
        raise ValueError("indicator frame is empty")
    latest = frame.iloc[-1]
    scoring = score_row(latest)
    confidence = int(scoring["confidence"])
    trend = trend_label(confidence)
    momentum = momentum_label(latest, scoring)
    risk = risk_label(latest)
    regime = market_regime(latest)
    levels = detect_support_resistance(frame)
    price = safe_float(latest.get("close"), 2)
    scenario = scenario_summary(
        trend=trend,
        price=price,
        support=levels.support,
        resistance=levels.resistance,
        regime=regime,
        momentum=momentum,
    )

    indicators = build_indicator_snapshot(latest)
    response = {
        "symbol": symbol.upper(),
        "timeframe": normalize_timeframe(timeframe),
        "trend": trend,
        "momentum": momentum,
        "risk": risk,
        "confidence": confidence,
        "market_regime": regime,
        "price": price,
        "indicators": indicators,
        "levels": {
            "support": levels.support,
            "resistance": levels.resistance,
        },
        "scenario": scenario,
        "insight": explanation or scenario,
        "explanation": explanation or scenario,
        "disclaimer": DISCLAIMER,
        "scoring": {
            "trend": scoring["trend_points"],
            "momentum": scoring["momentum_points"],
            "trend_strength": scoring["strength_points"],
            "volume_confirmation": scoring["volume_points"],
            "risk_adjustment": scoring["risk_adjustment"],
            "trend_score": scoring["trend_score"],
            "momentum_score": scoring["momentum_score"],
            "volume_score": scoring["volume_score"],
            "mtf_score": scoring["mtf_score"],
            "raw_score": safe_float(scoring["raw_score"], 2),
            "market_quality": 0,
            "multi_timeframe_confirmation": 0,
        },
        "quality_flags": [],
    }
    return response


def legacy_side_from_trend(trend: str) -> str:
    if trend in {"Bullish", "Strong Bullish"}:
        return "BUY"
    if trend == "Bearish":
        return "SELL"
    return "HOLD"


def legacy_score_from_confidence(confidence: int) -> float:
    return round(clamp(confidence / 100.0, 0.0, 1.0), 2)
