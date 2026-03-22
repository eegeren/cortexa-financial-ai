from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
import ta


DISCLAIMER = "This is not financial advice. It is an informational market analysis."
CORE_COLUMNS = ("open", "high", "low", "close", "volume")


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
    # Keep the neutral midpoint intact while compressing extremes so
    # bearish conviction does not collapse to zero too easily.
    adjusted = 50.0 + ((raw_score - 50.0) * 0.85)
    return int(round(clamp(adjusted, 5.0, 95.0)))


def normalize_timeframe(timeframe: str | None) -> str:
    value = (timeframe or "1h").strip().lower()
    return value or "1h"


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


def score_row(row: pd.Series) -> dict[str, Any]:
    score = 50.0
    trend_points = 0
    momentum_points = 0
    strength_points = 0
    volume_points = 0
    risk_adjustment = 0

    ema20 = safe_float(row.get("ema20"))
    ema50 = safe_float(row.get("ema50"))
    ema200 = safe_float(row.get("ema200"))
    price = safe_float(row.get("close"))
    rsi = safe_float(row.get("rsi"))
    macd = safe_float(row.get("macd"))
    macd_signal = safe_float(row.get("macd_signal"))
    adx = safe_float(row.get("adx"))
    atr_pct = safe_float(row.get("atr_pct"))
    volume_ratio = safe_float(row.get("volume_ratio"))
    reversal_context = False

    bullish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 > ema50 > ema200
    bearish_stack = ema20 is not None and ema50 is not None and ema200 is not None and ema20 < ema50 < ema200

    if bullish_stack:
        trend_points += 30
    elif bearish_stack:
        trend_points -= 30
    else:
        if ema20 is not None and ema50 is not None:
            trend_points += 8 if ema20 > ema50 else -8
        if ema50 is not None and ema200 is not None:
            trend_points += 10 if ema50 > ema200 else -10

    if price is not None and ema20 is not None:
        trend_points += 6 if price > ema20 else -6
    if price is not None and ema200 is not None:
        trend_points += 8 if price > ema200 else -8

    if rsi is not None:
        if 55 <= rsi <= 68:
            momentum_points += 8
        elif 45 <= rsi < 55:
            momentum_points += 0
        elif 30 <= rsi < 45:
            momentum_points -= 6
        elif rsi < 30:
            momentum_points -= 8
            reversal_context = True
        elif rsi > 68:
            momentum_points -= 6

    if macd is not None and macd_signal is not None:
        if macd > macd_signal and macd >= 0:
            momentum_points += 12
        elif macd > macd_signal and macd < 0:
            momentum_points += 4
        elif macd < macd_signal and macd < 0:
            momentum_points -= 12
        elif macd < macd_signal and macd >= 0:
            momentum_points -= 8

    if adx is not None:
        if adx >= 28:
            strength_points += 10
        elif adx >= 22:
            strength_points += 4
        elif adx < 18:
            strength_points -= 12
        elif adx < 22:
            strength_points -= 6

    if volume_ratio is not None:
        if volume_ratio >= 1.1:
            volume_points += 6
        elif volume_ratio < 0.65:
            volume_points -= 16
        elif volume_ratio < 0.85:
            volume_points -= 10

    if atr_pct is not None:
        if atr_pct >= 0.07:
            risk_adjustment -= 14
        elif atr_pct >= 0.05:
            risk_adjustment -= 8
        elif atr_pct <= 0.025:
            risk_adjustment += 3

    score += trend_points + momentum_points + strength_points + volume_points + risk_adjustment
    confidence = confidence_from_raw_score(score)

    return {
        "confidence": confidence,
        "trend_points": trend_points,
        "momentum_points": momentum_points,
        "strength_points": strength_points,
        "volume_points": volume_points,
        "risk_adjustment": risk_adjustment,
        "raw_score": score,
        "reversal_context": reversal_context,
    }


def trend_label(confidence: int) -> str:
    if confidence <= 25:
        return "Strong Bearish"
    if confidence <= 42:
        return "Bearish"
    if confidence <= 62:
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
    if atr_pct >= 0.06:
        return "High"
    if volume_ratio is not None and volume_ratio < 0.75:
        return "High"
    if adx is not None and adx < 18:
        return "High"
    if not aligned_structure and ((adx is not None and adx < 22) or (volume_ratio is not None and volume_ratio < 0.9)):
        return "High"
    if (
        atr_pct <= 0.018
        and (adx is None or adx >= 25)
        and (volume_ratio is None or volume_ratio >= 0.95)
        and aligned_structure
        and trend_side_confirmed
    ):
        return "Low"
    return "Medium"


def market_regime(row: pd.Series) -> str:
    adx = safe_float(row.get("adx"))
    atr_pct = safe_float(row.get("atr_pct"))
    volume_ratio = safe_float(row.get("volume_ratio"))

    if adx is not None and adx >= 25:
        return "Trending"
    if atr_pct is not None and atr_pct >= 0.05:
        return "Volatile"
    if volume_ratio is not None and volume_ratio < 0.8:
        return "Low Participation"
    return "Range-Bound"


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
        "explanation": explanation or scenario,
        "disclaimer": DISCLAIMER,
        "scoring": {
            "trend": scoring["trend_points"],
            "momentum": scoring["momentum_points"],
            "trend_strength": scoring["strength_points"],
            "volume_confirmation": scoring["volume_points"],
            "risk_adjustment": scoring["risk_adjustment"],
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
