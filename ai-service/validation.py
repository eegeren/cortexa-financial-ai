from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from analysis_engine import (
    apply_ai_validation_outcome,
    apply_quality_first_signal_filter,
    build_analysis,
    build_indicator_frame,
    clamp,
    coin_profile,
    deterministic_ai_validation_proxy,
)

SUPPORTED_VALIDATION_HORIZONS = (1, 4, 12)
CONFIDENCE_BUCKETS = ((0, 20), (20, 40), (40, 60), (60, 80), (80, 100))
SCORE_BUCKETS = (
    ("Strong Bearish", None, -60),
    ("Bearish", -59, -35),
    ("Neutral", -34, 34),
    ("Bullish", 35, 59),
    ("Strong Bullish", 60, None),
)


def _activation_bounds(threshold: float) -> tuple[int, int]:
    pct = int(round(max(0.0, min(1.0, threshold)) * 100))
    return 100 - pct, pct


def _trend_bias(trend: str) -> int:
    if trend == "Strong Bullish":
        return 2
    if trend == "Bullish":
        return 1
    if trend == "Strong Bearish":
        return -2
    if trend == "Bearish":
        return -1
    return 0


def _apply_validation_quality_filters(analysis: dict[str, Any], latest_row: pd.Series, *, use_ai_validation: bool) -> dict[str, Any]:
    filtered = apply_quality_first_signal_filter(
        analysis,
        latest_row,
        timeframe=str(analysis.get("timeframe", "1h")),
        stale=False,
        higher_timeframe_trend=None,
        higher_timeframe_stale=False,
    )
    if not use_ai_validation:
        filtered["ai_validated"] = None
        filtered["ai_setup_quality"] = None
        filtered["ai_validation_reason"] = "AI validation disabled for this backtest run."
        filtered["ai_confidence_adjustment"] = 0
        return filtered

    validation_input = {
        "symbol": filtered.get("symbol"),
        "timeframe": filtered.get("timeframe"),
        "trend": filtered.get("trend"),
        "confidence": filtered.get("confidence"),
        "risk": filtered.get("risk"),
        "market_regime": filtered.get("market_regime"),
        "quality_flags": filtered.get("quality_flags"),
        "indicators": filtered.get("indicators"),
        "levels": filtered.get("levels"),
        "scenario": filtered.get("scenario"),
        "scoring": filtered.get("scoring"),
        "coin_profile": filtered.get("coin_profile") or coin_profile(str(filtered.get("symbol", ""))),
        "price": filtered.get("price"),
    }
    ai_validation = deterministic_ai_validation_proxy(validation_input)
    return apply_ai_validation_outcome(filtered, ai_validation)


def _directional_final_score(analysis: dict[str, Any]) -> float:
    scoring = analysis.get("scoring", {})
    raw_score = float(scoring.get("raw_score") or 50.0)
    market_quality = float(scoring.get("market_quality") or 0.0)
    mtf = float(scoring.get("multi_timeframe_confirmation") or 0.0)
    return round(clamp((raw_score - 50.0) + market_quality + mtf, -100.0, 100.0), 2)


def analysis_history(df: pd.DataFrame, symbol: str, timeframe: str, *, use_ai_validation: bool = True) -> pd.DataFrame:
    frame = build_indicator_frame(df)
    records: list[dict[str, Any]] = []
    start_index = 199 if len(frame) > 199 else len(frame)

    for idx in range(start_index, len(frame)):
        window = frame.iloc[: idx + 1]
        analysis = build_analysis(window, symbol=symbol, timeframe=timeframe)
        analysis = _apply_validation_quality_filters(analysis, frame.iloc[idx], use_ai_validation=use_ai_validation)
        current = frame.iloc[idx]
        records.append(
            {
                "timestamp": frame.index[idx],
                "symbol": symbol.upper(),
                "coin_profile": str(analysis.get("coin_profile") or coin_profile(symbol)),
                "timeframe": timeframe,
                "entry_price": float(current["close"]),
                "signal_direction": analysis["trend"],
                "signal_bias": _trend_bias(str(analysis["trend"])),
                "confidence": int(analysis["confidence"]),
                "raw_score": float(analysis.get("scoring", {}).get("raw_score") or 50.0),
                "final_score": _directional_final_score(analysis),
                "risk": str(analysis["risk"]),
                "market_regime": str(analysis["market_regime"]),
                "quality_flags": list(analysis.get("quality_flags", [])),
                "ai_setup_quality": analysis.get("ai_setup_quality"),
                "ai_validated": analysis.get("ai_validated"),
                "momentum": str(analysis.get("momentum", "")),
                "atr_pct": float(current["atr_pct"]) if pd.notna(current["atr_pct"]) else np.nan,
                "adx": float(current["adx"]) if pd.notna(current["adx"]) else np.nan,
            }
        )

    signals = pd.DataFrame.from_records(records)
    if signals.empty:
        return signals

    for horizon in SUPPORTED_VALIDATION_HORIZONS:
        signals[f"future_return_{horizon}"] = signals["entry_price"].shift(-horizon) / signals["entry_price"] - 1.0
    return signals


def _neutral_band(row: pd.Series) -> float:
    atr_pct = float(row["atr_pct"]) if pd.notna(row.get("atr_pct")) else 0.006
    return float(clamp(max(0.003, atr_pct * 0.55), 0.003, 0.015))


def _is_good_outcome(direction: str, future_return: float, neutral_band: float) -> bool:
    if direction in {"Bullish", "Strong Bullish"}:
        return future_return > 0
    if direction in {"Bearish", "Strong Bearish"}:
        return future_return < 0
    return abs(future_return) <= neutral_band


def _strategy_return(direction: str, future_return: float) -> float:
    if direction in {"Bullish", "Strong Bullish"}:
        return future_return
    if direction in {"Bearish", "Strong Bearish"}:
        return -future_return
    return 0.0


def _bucket_rows(frame: pd.DataFrame, min_value: float | None, max_value: float | None, column: str) -> pd.DataFrame:
    if min_value is None:
        return frame[frame[column] <= max_value]
    if max_value is None:
        return frame[frame[column] >= min_value]
    return frame[(frame[column] >= min_value) & (frame[column] <= max_value)]


def _directional_accuracy(frame: pd.DataFrame) -> float:
    if frame.empty:
        return 0.0
    return float(frame["is_good_outcome"].mean())


def _median_or_zero(series: pd.Series) -> float:
    return float(series.median()) if not series.empty else 0.0


def _avg_or_zero(series: pd.Series) -> float:
    return float(series.mean()) if not series.empty else 0.0


def _compute_max_drawdown(net_returns: pd.Series) -> float:
    if net_returns.empty:
        return 0.0
    equity = (1.0 + net_returns.fillna(0.0)).cumprod()
    running_peak = equity.cummax()
    drawdown = (equity / running_peak) - 1.0
    return float(drawdown.min())


def validate_analysis_history(
    df: pd.DataFrame,
    *,
    symbol: str,
    timeframe: str,
    threshold: float,
    horizon: int,
    commission_bps: float,
    slippage_bps: float,
    position_size: float,
    use_ai_validation: bool = True,
) -> dict[str, Any]:
    profile = coin_profile(symbol)
    signals = analysis_history(df, symbol, timeframe, use_ai_validation=use_ai_validation)
    if signals.empty:
        return {
            "symbol": symbol.upper(),
            "coin_profile": profile,
            "timeframe": timeframe,
            "threshold": threshold,
            "limit": int(len(df)),
            "horizon": horizon,
            "available_horizons": list(SUPPORTED_VALIDATION_HORIZONS),
            "commission_bps": commission_bps,
            "slippage_bps": slippage_bps,
            "position_size": position_size,
            "use_ai_validation": use_ai_validation,
            "total_samples": 0,
            "trades": 0,
            "bullish_hit_rate": 0.0,
            "bearish_hit_rate": 0.0,
            "neutral_hit_rate": 0.0,
            "overall_directional_accuracy": 0.0,
            "history": [],
            "sample_rows": [],
            "signal_type_metrics": [],
            "confidence_buckets": [],
            "score_buckets": [],
            "setup_quality_buckets": [],
            "coin_profile_metrics": [],
            "validation": {"records": [], "activation_threshold": threshold},
        }

    future_col = f"future_return_{horizon}"
    if future_col not in signals.columns:
        raise ValueError(f"unsupported horizon {horizon}")

    working = signals[signals[future_col].notna()].copy()
    working["future_return"] = working[future_col]
    working["neutral_band"] = working.apply(_neutral_band, axis=1)
    working["is_good_outcome"] = working.apply(
        lambda row: _is_good_outcome(str(row["signal_direction"]), float(row["future_return"]), float(row["neutral_band"])),
        axis=1,
    )
    working["strategy_return_gross"] = working.apply(
        lambda row: _strategy_return(str(row["signal_direction"]), float(row["future_return"])),
        axis=1,
    )
    cost_return = (commission_bps * 2.0 + slippage_bps * 2.0) / 10000.0
    working["is_directional"] = working["signal_direction"].isin(["Bullish", "Strong Bullish", "Bearish", "Strong Bearish"])
    working["activation_score"] = working["final_score"].abs() / 100.0
    active = working[(working["is_directional"]) & (working["activation_score"] >= threshold)].copy()
    active["net_return"] = active["strategy_return_gross"] - cost_return
    active["gross_value"] = active["strategy_return_gross"] * position_size
    active["net_value"] = active["net_return"] * position_size
    active["cum_net_value"] = active["net_value"].cumsum()

    signal_type_metrics: list[dict[str, Any]] = []
    for label in ("Strong Bullish", "Bullish", "Neutral", "Bearish", "Strong Bearish"):
        subset = working[working["signal_direction"] == label]
        signal_type_metrics.append(
            {
                "signal_type": label,
                "samples": int(len(subset)),
                "directional_accuracy": _directional_accuracy(subset),
                "avg_future_return": _avg_or_zero(subset["future_return"]),
                "median_future_return": _median_or_zero(subset["future_return"]),
                "avg_strategy_return": _avg_or_zero(subset["strategy_return_gross"]),
            }
        )

    confidence_buckets: list[dict[str, Any]] = []
    for low, high in CONFIDENCE_BUCKETS:
        if high == 100:
            subset = working[(working["confidence"] >= low) & (working["confidence"] <= high)]
            label = f"{low}-{high}"
        else:
            subset = working[(working["confidence"] >= low) & (working["confidence"] < high)]
            label = f"{low}-{high}"
        confidence_buckets.append(
            {
                "bucket": label,
                "samples": int(len(subset)),
                "avg_future_return": _avg_or_zero(subset["future_return"]),
                "median_future_return": _median_or_zero(subset["future_return"]),
                "avg_strategy_return": _avg_or_zero(subset["strategy_return_gross"]),
                "directional_accuracy": _directional_accuracy(subset),
            }
        )

    score_buckets: list[dict[str, Any]] = []
    for bucket, min_value, max_value in SCORE_BUCKETS:
        subset = _bucket_rows(working, min_value, max_value, "final_score")
        score_buckets.append(
            {
                "bucket": bucket,
                "samples": int(len(subset)),
                "trades": int(len(subset)),
                "avg_future_return": _avg_or_zero(subset["future_return"]),
                "median_future_return": _median_or_zero(subset["future_return"]),
                "avg_strategy_return": _avg_or_zero(subset["strategy_return_gross"]),
                "net_return_avg": _avg_or_zero(subset["strategy_return_gross"]),
                "hit_rate": _directional_accuracy(subset),
                "directional_accuracy": _directional_accuracy(subset),
            }
        )

    setup_quality_buckets: list[dict[str, Any]] = []
    for bucket in ("high", "medium", "low"):
        subset = working[working["ai_setup_quality"] == bucket] if use_ai_validation else working.iloc[0:0]
        setup_quality_buckets.append(
            {
                "bucket": bucket,
                "samples": int(len(subset)),
                "avg_future_return": _avg_or_zero(subset["future_return"]),
                "median_future_return": _median_or_zero(subset["future_return"]),
                "avg_strategy_return": _avg_or_zero(subset["strategy_return_gross"]),
                "directional_accuracy": _directional_accuracy(subset),
            }
        )

    coin_profile_subset = working[working["coin_profile"] == profile]
    coin_profile_metrics = [
        {
            "bucket": profile,
            "samples": int(len(coin_profile_subset)),
            "avg_future_return": _avg_or_zero(coin_profile_subset["future_return"]),
            "median_future_return": _median_or_zero(coin_profile_subset["future_return"]),
            "avg_strategy_return": _avg_or_zero(coin_profile_subset["strategy_return_gross"]),
            "directional_accuracy": _directional_accuracy(coin_profile_subset),
        }
    ]

    bullish = working[working["signal_direction"].isin(["Bullish", "Strong Bullish"])]
    bearish = working[working["signal_direction"].isin(["Bearish", "Strong Bearish"])]
    neutral = working[working["signal_direction"] == "Neutral"]

    gross_returns = active["strategy_return_gross"].to_numpy() if not active.empty else np.array([])
    net_returns = active["net_return"].to_numpy() if not active.empty else np.array([])
    downside = net_returns[net_returns < 0]
    sharpe = float(np.sqrt(len(net_returns)) * np.mean(net_returns) / np.std(net_returns)) if len(net_returns) and np.std(net_returns) > 1e-8 else 0.0
    sortino = float(np.sqrt(len(net_returns)) * np.mean(net_returns) / np.std(downside)) if len(downside) and np.std(downside) > 1e-8 else 0.0
    gross_profit = float(active.loc[active["net_return"] > 0, "net_return"].sum()) if not active.empty else 0.0
    gross_loss = float(abs(active.loc[active["net_return"] < 0, "net_return"].sum())) if not active.empty else 0.0
    win_avg = _avg_or_zero(active.loc[active["net_return"] > 0, "net_return"])
    loss_avg = abs(_avg_or_zero(active.loc[active["net_return"] < 0, "net_return"]))

    equity_curve = [
        {
            "time": row["timestamp"].isoformat(),
            "net_value": float(row["cum_net_value"]),
        }
        for _, row in active.iterrows()
    ]

    history = [
        {
            "time": row["timestamp"].isoformat(),
            "side": "BULLISH" if row["signal_bias"] > 0 else "BEARISH",
            "score": float(row["activation_score"]),
            "fwd_return": float(row["future_return"]),
            "gross_return": float(row["strategy_return_gross"]),
            "net_return": float(row["net_return"]),
            "gross_value": float(row["gross_value"]),
            "net_value": float(row["net_value"]),
        }
        for _, row in active.tail(150).iterrows()
    ]

    sample_rows = [
        {
            "timestamp": row["timestamp"].isoformat(),
            "symbol": row["symbol"],
            "timeframe": row["timeframe"],
            "signal_direction": row["signal_direction"],
            "confidence": int(row["confidence"]),
            "raw_score": float(row["raw_score"]),
            "final_score": float(row["final_score"]),
            "risk": row["risk"],
            "market_regime": row["market_regime"],
            "quality_flags": row["quality_flags"],
            "coin_profile": row["coin_profile"],
            "ai_setup_quality": row["ai_setup_quality"],
            "entry_price": float(row["entry_price"]),
            "future_return_1": float(row["future_return_1"]) if pd.notna(row["future_return_1"]) else None,
            "future_return_4": float(row["future_return_4"]) if pd.notna(row["future_return_4"]) else None,
            "future_return_12": float(row["future_return_12"]) if pd.notna(row["future_return_12"]) else None,
            "future_return": float(row["future_return"]),
            "directional_accuracy": bool(row["is_good_outcome"]),
        }
        for _, row in working.tail(200).iterrows()
    ]

    validation_records = [
        {
            "time": row["timestamp"].isoformat(),
            "trend": row["signal_direction"],
            "confidence": int(row["confidence"]),
            "raw_score": float(row["raw_score"]),
            "final_score": float(row["final_score"]),
            "forward_return": float(row["future_return"]),
            "direction": int(row["signal_bias"]),
            "market_regime": row["market_regime"],
            "quality_flags": row["quality_flags"],
            "coin_profile": row["coin_profile"],
            "ai_setup_quality": row["ai_setup_quality"],
        }
        for _, row in working.tail(250).iterrows()
    ]

    return {
        "symbol": symbol.upper(),
        "coin_profile": profile,
        "timeframe": timeframe,
        "threshold": threshold,
        "limit": int(len(df)),
        "horizon": horizon,
        "available_horizons": list(SUPPORTED_VALIDATION_HORIZONS),
        "commission_bps": commission_bps,
        "slippage_bps": slippage_bps,
        "position_size": position_size,
        "use_ai_validation": use_ai_validation,
        "total_samples": int(len(working)),
        "trades": int(len(active)),
        "gross_value_sum": float(active["gross_value"].sum()) if not active.empty else 0.0,
        "net_value_sum": float(active["net_value"].sum()) if not active.empty else 0.0,
        "gross_return_sum": float(active["strategy_return_gross"].sum()) if not active.empty else 0.0,
        "net_return_sum": float(active["net_return"].sum()) if not active.empty else 0.0,
        "hit_rate": _directional_accuracy(active),
        "bullish_hit_rate": _directional_accuracy(bullish),
        "bearish_hit_rate": _directional_accuracy(bearish),
        "neutral_hit_rate": _directional_accuracy(neutral),
        "overall_directional_accuracy": _directional_accuracy(working),
        "cost_return": cost_return,
        "history": history,
        "sample_rows": sample_rows,
        "equity_curve": equity_curve,
        "regime_metrics": [],
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": _compute_max_drawdown(active["net_return"]) if not active.empty else 0.0,
        "avg_win": win_avg,
        "avg_loss": -loss_avg if loss_avg else 0.0,
        "expectancy": _avg_or_zero(active["net_return"]),
        "profit_factor": float(gross_profit / gross_loss) if gross_loss > 1e-8 else 0.0,
        "win_loss_ratio": float(win_avg / loss_avg) if loss_avg > 1e-8 else 0.0,
        "median_return": _median_or_zero(active["net_return"]),
        "return_std": float(active["net_return"].std()) if len(active) > 1 else 0.0,
        "return_quantiles": {
            "p05": float(active["net_return"].quantile(0.05)) if not active.empty else 0.0,
            "p25": float(active["net_return"].quantile(0.25)) if not active.empty else 0.0,
            "p50": float(active["net_return"].quantile(0.50)) if not active.empty else 0.0,
            "p75": float(active["net_return"].quantile(0.75)) if not active.empty else 0.0,
            "p95": float(active["net_return"].quantile(0.95)) if not active.empty else 0.0,
        },
        "side_breakdown": {
            "buy": {
                "trades": int(len(bullish)),
                "net_return_sum": float(bullish["strategy_return_gross"].sum()) if not bullish.empty else 0.0,
                "hit_rate": _directional_accuracy(bullish),
                "avg_return": _avg_or_zero(bullish["strategy_return_gross"]),
                "avg_score": _avg_or_zero(bullish["activation_score"]),
            },
            "sell": {
                "trades": int(len(bearish)),
                "net_return_sum": float(bearish["strategy_return_gross"].sum()) if not bearish.empty else 0.0,
                "hit_rate": _directional_accuracy(bearish),
                "avg_return": _avg_or_zero(bearish["strategy_return_gross"]),
                "avg_score": _avg_or_zero(bearish["activation_score"]),
            },
        },
        "weekday_breakdown": [],
        "streaks": {"longest_win": 0, "longest_loss": 0},
        "exposure": {
            "bars": int(len(active) * horizon),
            "minutes": float(len(active) * horizon * 60),
            "hours": float(len(active) * horizon),
            "days": float(len(active) * horizon / 24.0),
            "ratio": float((len(active) * horizon) / len(df)) if len(df) else 0.0,
        },
        "signal_type_metrics": signal_type_metrics,
        "confidence_buckets": confidence_buckets,
        "score_buckets": score_buckets,
        "setup_quality_buckets": setup_quality_buckets,
        "coin_profile_metrics": coin_profile_metrics,
        "validation": {
            "records": validation_records,
            "activation_threshold": threshold,
            "upper_confidence": _activation_bounds(threshold)[1],
            "lower_confidence": _activation_bounds(threshold)[0],
        },
    }
