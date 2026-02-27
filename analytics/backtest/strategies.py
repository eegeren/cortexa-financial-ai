"""Baseline EMA/RSI signal generation and simple evaluation."""
from __future__ import annotations

import pandas as pd
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import ta


@dataclass
class SignalResult:
    data: pd.DataFrame
    pnl: float
    trades: int
    hit_rate: float


INDICATOR_COLUMNS = [
    "ema_fast",
    "ema_slow",
    "macd_hist",
    "rsi",
    "bb_mid",
    "atr",
    "atr_pct",
    "adx",
]


def load_klines_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["open_time", "close_time"])
    df = df.set_index("open_time").sort_index()
    numeric_cols = ["open", "high", "low", "close", "volume"]
    df[numeric_cols] = df[numeric_cols].astype(float)
    return df


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    close = result["close"]
    high = result["high"]
    low = result["low"]

    result["ema_fast"] = ta.trend.EMAIndicator(close, window=12).ema_indicator()
    result["ema_slow"] = ta.trend.EMAIndicator(close, window=26).ema_indicator()
    macd = ta.trend.MACD(close, window_fast=12, window_slow=26, window_sign=9)
    result["macd_hist"] = macd.macd_diff()
    result["rsi"] = ta.momentum.RSIIndicator(close, window=14).rsi()
    bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
    result["bb_mid"] = bb.bollinger_mavg()
    atr = ta.volatility.AverageTrueRange(high, low, close, window=14)
    result["atr"] = atr.average_true_range()
    result["atr_pct"] = (result["atr"] / close).clip(lower=0)
    adx = ta.trend.ADXIndicator(high, low, close, window=14)
    result["adx"] = adx.adx()
    return result


def compute_votes(row: pd.Series) -> float:
    votes = 0.0
    if pd.notna(row["ema_fast"]) and pd.notna(row["ema_slow"]):
        votes += 1 if row["ema_fast"] > row["ema_slow"] else -1
    if pd.notna(row["macd_hist"]):
        votes += 1 if row["macd_hist"] > 0 else -1
    if pd.notna(row["rsi"]):
        votes += 0.5 if row["rsi"] > 50 else -0.5
    if pd.notna(row["bb_mid"]) and pd.notna(row["close"]):
        votes += 0.5 if row["close"] > row["bb_mid"] else -0.5
    return votes


def compute_signal_row(base: pd.Series, h1: pd.Series, h4: pd.Series) -> Tuple[str, float]:
    adx_ok = pd.notna(base["adx"]) and base["adx"] >= 15
    atr_pct = base["atr_pct"]
    vol_ok = pd.notna(atr_pct) and 0.001 <= atr_pct <= 0.03

    v_base = compute_votes(base)
    v_h1 = compute_votes(h1)
    v_h4 = compute_votes(h4)

    side = "HOLD"
    if v_base > 0 and v_h1 >= 0 and v_h4 >= 0 and adx_ok and vol_ok:
        side = "BUY"
    elif v_base < 0 and v_h1 <= 0 and v_h4 <= 0 and adx_ok and vol_ok:
        side = "SELL"

    score = score_from_components(v_base, v_h1, v_h4, adx_ok, vol_ok)
    return side, score


def score_from_components(v_base: float, v_h1: float, v_h4: float, adx_ok: bool, vol_ok: bool) -> float:
    align = 0.0
    if v_base > 0:
        if v_h1 > 0:
            align += 0.25
        if v_h4 > 0:
            align += 0.25
    elif v_base < 0:
        if v_h1 < 0:
            align += 0.25
        if v_h4 < 0:
            align += 0.25

    def norm(v: float) -> float:
        return max(0.0, min(1.0, (v + 3.0) / 6.0))

    base_s = norm(v_base)
    h1_s = norm(v_h1)
    h4_s = norm(v_h4)
    regime = (0.2 if adx_ok else -0.2) + (0.2 if vol_ok else -0.2)
    raw = 0.5 * base_s + 0.2 * h1_s + 0.1 * h4_s + align + regime
    return max(0.0, min(1.0, raw))


def generate_signals(
    base_path: Path,
    h1_path: Path,
    h4_path: Path,
    threshold: float = 0.6,
    horizon: int = 4,
) -> SignalResult:
    base = add_indicators(load_klines_csv(base_path))
    h1 = add_indicators(load_klines_csv(h1_path))
    h4 = add_indicators(load_klines_csv(h4_path))

    h1 = h1.reindex(base.index, method="ffill")
    h4 = h4.reindex(base.index, method="ffill")

    signals = base.copy()[["close"]]
    sides = []
    scores = []
    for idx, row in base.iterrows():
        side, score = compute_signal_row(row, h1.loc[idx], h4.loc[idx])
        sides.append(side)
        scores.append(score)
    signals["side"] = sides
    signals["score"] = scores

    signals["fwd_return"] = signals["close"].shift(-horizon) / signals["close"] - 1
    mask = (signals["side"].isin(["BUY", "SELL"])) & (signals["score"] >= threshold)
    trades = signals[mask].copy()
    trades["direction"] = trades["side"].map({"BUY": 1, "SELL": -1})
    trades["pnl"] = trades["direction"] * trades["fwd_return"]

    pnl = trades["pnl"].sum()
    total = len(trades)
    hits = (trades["pnl"] > 0).sum()
    hit_rate = hits / total if total > 0 else 0.0

    return SignalResult(data=signals, pnl=pnl, trades=total, hit_rate=hit_rate)
