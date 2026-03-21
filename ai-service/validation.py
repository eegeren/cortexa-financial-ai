from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from analysis_engine import (
    build_analysis,
    build_indicator_frame,
    legacy_score_from_confidence,
    legacy_side_from_trend,
)


def _activation_bounds(threshold: float) -> tuple[int, int]:
    pct = int(round(max(0.0, min(1.0, threshold)) * 100))
    return 100 - pct, pct


def analysis_history(df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
    frame = build_indicator_frame(df)
    records: list[dict[str, Any]] = []
    start_index = 199 if len(frame) > 199 else len(frame)

    for idx in range(start_index, len(frame)):
        window = frame.iloc[: idx + 1]
        analysis = build_analysis(window, symbol=symbol, timeframe=timeframe)
        current = frame.iloc[idx]
        records.append(
            {
                "open_time": frame.index[idx],
                "close": float(current["close"]),
                "trend": analysis["trend"],
                "confidence": analysis["confidence"],
                "score": legacy_score_from_confidence(analysis["confidence"]),
                "side": legacy_side_from_trend(analysis["trend"]),
                "market_regime": analysis["market_regime"],
                "risk": analysis["risk"],
                "momentum": analysis["momentum"],
                "atr_pct": float(current["atr_pct"]) if pd.notna(current["atr_pct"]) else np.nan,
                "adx": float(current["adx"]) if pd.notna(current["adx"]) else np.nan,
            }
        )

    return pd.DataFrame.from_records(records)


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
) -> dict[str, Any]:
    signals = analysis_history(df, symbol, timeframe)
    if signals.empty:
        return {
            "symbol": symbol.upper(),
            "threshold": threshold,
            "limit": int(len(df)),
            "horizon": horizon,
            "commission_bps": commission_bps,
            "slippage_bps": slippage_bps,
            "position_size": position_size,
            "trades": 0,
            "gross_value_sum": 0.0,
            "net_value_sum": 0.0,
            "gross_return_sum": 0.0,
            "net_return_sum": 0.0,
            "hit_rate": 0.0,
            "cost_return": (commission_bps * 2.0 + slippage_bps * 2.0) / 10000.0,
            "history": [],
            "validation": {"records": [], "activation_threshold": threshold},
        }

    lower_bound, upper_bound = _activation_bounds(threshold)
    signals["fwd_return"] = signals["close"].shift(-horizon) / signals["close"] - 1
    signals["direction"] = 0
    signals.loc[signals["confidence"] >= upper_bound, "direction"] = 1
    signals.loc[signals["confidence"] <= lower_bound, "direction"] = -1

    active = signals[(signals["direction"] != 0) & signals["fwd_return"].notna()].copy()
    active["gross_return"] = active["direction"] * active["fwd_return"]
    cost_return = (commission_bps * 2.0 + slippage_bps * 2.0) / 10000.0
    active["net_return"] = active["gross_return"] - cost_return
    active["gross_value"] = active["gross_return"] * position_size
    active["net_value"] = active["net_return"] * position_size
    active["cum_net_value"] = active["net_value"].cumsum()

    trades = int(len(active))
    hit_rate = float((active["gross_return"] > 0).mean()) if trades else 0.0
    net_returns = active["net_return"].to_numpy() if trades else np.array([])
    sharpe = float(np.sqrt(trades) * np.mean(net_returns) / np.std(net_returns)) if trades and np.std(net_returns) > 1e-8 else 0.0

    equity_curve = [
        {
            "time": row["open_time"].isoformat(),
            "net_value": float(row["cum_net_value"]),
        }
        for _, row in active.iterrows()
    ]

    history = [
        {
            "time": row["open_time"].isoformat(),
            "side": "BULLISH" if row["direction"] > 0 else "BEARISH",
            "score": float(row["score"]),
            "fwd_return": float(row["fwd_return"]),
            "gross_return": float(row["gross_return"]),
            "net_return": float(row["net_return"]),
            "gross_value": float(row["gross_value"]),
            "net_value": float(row["net_value"]),
        }
        for _, row in active.tail(100).iterrows()
    ]

    validation_records = [
        {
            "time": row["open_time"].isoformat(),
            "trend": row["trend"],
            "confidence": int(row["confidence"]),
            "forward_return": float(row["fwd_return"]),
            "direction": int(row["direction"]),
            "market_regime": row["market_regime"],
        }
        for _, row in active.tail(200).iterrows()
    ]

    return {
        "symbol": symbol.upper(),
        "threshold": threshold,
        "limit": int(len(df)),
        "horizon": horizon,
        "commission_bps": commission_bps,
        "slippage_bps": slippage_bps,
        "position_size": position_size,
        "trades": trades,
        "gross_value_sum": float(active["gross_value"].sum()) if trades else 0.0,
        "net_value_sum": float(active["net_value"].sum()) if trades else 0.0,
        "gross_return_sum": float(active["gross_return"].sum()) if trades else 0.0,
        "net_return_sum": float(active["net_return"].sum()) if trades else 0.0,
        "hit_rate": hit_rate,
        "cost_return": cost_return,
        "history": history,
        "equity_curve": equity_curve,
        "regime_metrics": [],
        "sharpe": sharpe,
        "sortino": 0.0,
        "max_drawdown": 0.0,
        "avg_win": float(active.loc[active["net_return"] > 0, "net_return"].mean()) if trades and (active["net_return"] > 0).any() else 0.0,
        "avg_loss": float(active.loc[active["net_return"] < 0, "net_return"].mean()) if trades and (active["net_return"] < 0).any() else 0.0,
        "expectancy": float(active["net_return"].mean()) if trades else 0.0,
        "profit_factor": 0.0,
        "win_loss_ratio": 0.0,
        "median_return": float(active["net_return"].median()) if trades else 0.0,
        "return_std": float(active["net_return"].std()) if trades else 0.0,
        "return_quantiles": {
            "p05": float(active["net_return"].quantile(0.05)) if trades else 0.0,
            "p25": float(active["net_return"].quantile(0.25)) if trades else 0.0,
            "p50": float(active["net_return"].quantile(0.50)) if trades else 0.0,
            "p75": float(active["net_return"].quantile(0.75)) if trades else 0.0,
            "p95": float(active["net_return"].quantile(0.95)) if trades else 0.0,
        },
        "side_breakdown": {
            "buy": {
                "trades": int((active["direction"] > 0).sum()) if trades else 0,
                "net_return_sum": float(active.loc[active["direction"] > 0, "net_return"].sum()) if trades else 0.0,
                "hit_rate": float((active.loc[active["direction"] > 0, "gross_return"] > 0).mean()) if (active["direction"] > 0).any() else 0.0,
                "avg_return": float(active.loc[active["direction"] > 0, "net_return"].mean()) if (active["direction"] > 0).any() else 0.0,
                "avg_score": float(active.loc[active["direction"] > 0, "score"].mean()) if (active["direction"] > 0).any() else 0.0,
            },
            "sell": {
                "trades": int((active["direction"] < 0).sum()) if trades else 0,
                "net_return_sum": float(active.loc[active["direction"] < 0, "net_return"].sum()) if trades else 0.0,
                "hit_rate": float((active.loc[active["direction"] < 0, "gross_return"] > 0).mean()) if (active["direction"] < 0).any() else 0.0,
                "avg_return": float(active.loc[active["direction"] < 0, "net_return"].mean()) if (active["direction"] < 0).any() else 0.0,
                "avg_score": float(active.loc[active["direction"] < 0, "score"].mean()) if (active["direction"] < 0).any() else 0.0,
            },
        },
        "weekday_breakdown": [],
        "streaks": {"longest_win": 0, "longest_loss": 0},
        "exposure": {
            "bars": int(trades * horizon),
            "minutes": float(trades * horizon * 60),
            "hours": float(trades * horizon),
            "days": float(trades * horizon / 24.0),
            "ratio": float((trades * horizon) / len(df)) if len(df) else 0.0,
        },
        "score_buckets": [],
        "validation": {
            "records": validation_records,
            "activation_threshold": threshold,
            "upper_confidence": upper_bound,
            "lower_confidence": lower_bound,
        },
    }
