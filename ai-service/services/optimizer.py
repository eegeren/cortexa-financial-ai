from __future__ import annotations

import itertools
import json
import logging
import math
import os
import time
from dataclasses import dataclass
from multiprocessing import get_context
from typing import Any

import numpy as np
import pandas as pd
import psycopg
import requests
from psycopg.rows import dict_row
from redis import Redis
from requests.adapters import HTTPAdapter

try:
    import pandas_ta as pta  # type: ignore
except Exception:  # pragma: no cover
    pta = None

try:
    import ta
except Exception:  # pragma: no cover
    ta = None


logger = logging.getLogger("ai-service.optimizer")

DEFAULT_PARAMS: dict[str, int] = {
    "ema_fast": 20,
    "ema_slow": 50,
    "ema_trend": 200,
    "rsi_period": 14,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "adx_period": 14,
    "atr_period": 14,
    "volume_ma": 20,
}

TIMEFRAME_TO_INTERVAL = {
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}

_SESSION = requests.Session()
_SESSION.mount("https://", HTTPAdapter(max_retries=2))
_SESSION.mount("http://", HTTPAdapter(max_retries=2))


def normalize_pair(pair: str) -> str:
    normalized = (pair or "").strip().upper().replace("-", "").replace("_", "").replace(" ", "")
    if "/" in normalized:
        return normalized.replace("/", "")
    return normalized


def normalize_timeframe(timeframe: str) -> str:
    value = (timeframe or "1h").strip().lower()
    return value if value in TIMEFRAME_TO_INTERVAL else "1h"


def cache_key(pair: str, timeframe: str) -> str:
    return f"optimal_params:{normalize_pair(pair)}:{normalize_timeframe(timeframe)}"


def _json_default(value: Any):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        cast = float(value)
        return cast if math.isfinite(cast) else None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    raise TypeError(f"Unsupported type: {type(value)!r}")


def _get_redis() -> Redis | None:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        return None
    try:
        return Redis.from_url(redis_url, decode_responses=True)
    except Exception as exc:
        logger.warning("optimizer redis unavailable: %s", exc)
        return None


def _get_db_connection():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        return None
    try:
        return psycopg.connect(database_url, row_factory=dict_row)
    except Exception as exc:
        logger.warning("optimizer database unavailable: %s", exc)
        return None


def load_optimized_record(pair: str, timeframe: str) -> dict[str, Any] | None:
    normalized_pair = normalize_pair(pair)
    normalized_timeframe = normalize_timeframe(timeframe)
    redis_client = _get_redis()
    key = cache_key(normalized_pair, normalized_timeframe)
    if redis_client is not None:
        try:
            cached = redis_client.get(key)
            if cached:
                payload = json.loads(cached)
                payload["param_source"] = "optimized"
                return payload
        except Exception as exc:
            logger.warning("optimizer redis read failed for %s %s: %s", normalized_pair, normalized_timeframe, exc)

    conn = _get_db_connection()
    if conn is None:
        return None
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT pair, timeframe, params, win_rate, profit_factor, sharpe_ratio,
                       max_drawdown_pct, total_signals, overfitting_flag, optimized_at
                FROM optimized_params
                WHERE pair = %s AND timeframe = %s
                """,
                (normalized_pair, normalized_timeframe),
            )
            row = cur.fetchone()
            if not row:
                return None
            payload = dict(row)
            payload["param_source"] = "optimized"
            if redis_client is not None:
                try:
                    redis_client.setex(key, 7 * 24 * 3600, json.dumps(payload, default=_json_default))
                except Exception:
                    pass
            return payload
    except Exception as exc:
        logger.warning("optimizer db read failed for %s %s: %s", normalized_pair, normalized_timeframe, exc)
        return None
    finally:
        conn.close()


def clear_optimization_cache(pair: str | None = None, timeframe: str | None = None) -> int:
    redis_client = _get_redis()
    if redis_client is None:
        return 0
    try:
        if pair and timeframe:
            return int(redis_client.delete(cache_key(pair, timeframe)))
        pattern = "optimal_params:*"
        deleted = 0
        for key in redis_client.scan_iter(match=pattern):
            deleted += int(redis_client.delete(key))
        return deleted
    except Exception as exc:
        logger.warning("optimizer cache clear failed: %s", exc)
        return 0


def list_optimized_status() -> list[dict[str, Any]]:
    conn = _get_db_connection()
    if conn is None:
        return []
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT pair, timeframe, params, win_rate, profit_factor, sharpe_ratio,
                       max_drawdown_pct, total_signals, overfitting_flag, optimized_at
                FROM optimized_params
                ORDER BY optimized_at DESC, pair ASC, timeframe ASC
                """
            )
            rows = [dict(row) for row in cur.fetchall()]
            for row in rows:
                row["param_source"] = "optimized"
            return rows
    except Exception as exc:
        logger.warning("optimizer status listing failed: %s", exc)
        return []
    finally:
        conn.close()


def upsert_optimized_result(
    pair: str,
    timeframe: str,
    params: dict[str, Any],
    metrics: dict[str, Any],
    *,
    overfitting_flag: bool = False,
) -> dict[str, Any] | None:
    normalized_pair = normalize_pair(pair)
    normalized_timeframe = normalize_timeframe(timeframe)
    conn = _get_db_connection()
    if conn is None:
        return None
    previous = load_optimized_record(normalized_pair, normalized_timeframe)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO optimized_params (
                    pair, timeframe, params, win_rate, profit_factor, sharpe_ratio,
                    max_drawdown_pct, total_signals, overfitting_flag
                )
                VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (pair, timeframe)
                DO UPDATE SET
                    params = EXCLUDED.params,
                    win_rate = EXCLUDED.win_rate,
                    profit_factor = EXCLUDED.profit_factor,
                    sharpe_ratio = EXCLUDED.sharpe_ratio,
                    max_drawdown_pct = EXCLUDED.max_drawdown_pct,
                    total_signals = EXCLUDED.total_signals,
                    overfitting_flag = EXCLUDED.overfitting_flag,
                    optimized_at = NOW()
                RETURNING pair, timeframe, params, win_rate, profit_factor, sharpe_ratio,
                          max_drawdown_pct, total_signals, overfitting_flag, optimized_at
                """,
                (
                    normalized_pair,
                    normalized_timeframe,
                    json.dumps(params, default=_json_default),
                    float(metrics.get("win_rate", 0.0)),
                    float(metrics.get("profit_factor", 0.0)),
                    float(metrics.get("sharpe_ratio", 0.0)),
                    float(metrics.get("max_drawdown_pct", 0.0)),
                    int(metrics.get("total_signals", 0)),
                    bool(overfitting_flag),
                ),
            )
            row = dict(cur.fetchone())
        redis_client = _get_redis()
        if redis_client is not None:
            try:
                payload = dict(row)
                payload["param_source"] = "optimized"
                redis_client.setex(cache_key(normalized_pair, normalized_timeframe), 7 * 24 * 3600, json.dumps(payload, default=_json_default))
            except Exception as exc:
                logger.warning("optimizer redis write failed for %s %s: %s", normalized_pair, normalized_timeframe, exc)

        old_win_rate = float(previous.get("win_rate", 0.0)) if previous else 0.0
        new_win_rate = float(metrics.get("win_rate", 0.0))
        logger.info(
            "optimizer_result pair=%s timeframe=%s old_win_rate=%.4f new_win_rate=%.4f delta=%.4f",
            normalized_pair,
            normalized_timeframe,
            old_win_rate,
            new_win_rate,
            new_win_rate - old_win_rate,
        )
        row["param_source"] = "optimized"
        return row
    except Exception as exc:
        logger.exception("optimizer upsert failed for %s %s: %s", normalized_pair, normalized_timeframe, exc)
        return None
    finally:
        conn.close()


@dataclass
class OptimizationCandidate:
    params: dict[str, int]
    metrics: dict[str, float | int]


def _manual_rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _manual_atr(df: pd.DataFrame, period: int) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift(1)).abs()
    low_close = (df["low"] - df["close"].shift(1)).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


def _manual_adx(df: pd.DataFrame, period: int) -> pd.Series:
    up_move = df["high"].diff()
    down_move = -df["low"].diff()
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    tr = _manual_atr(df, period)
    plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=1 / period, adjust=False, min_periods=period).mean() / tr.replace(0, np.nan)
    minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=1 / period, adjust=False, min_periods=period).mean() / tr.replace(0, np.nan)
    dx = ((plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)) * 100
    return dx.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


class ParameterOptimizer:
    PARAM_GRID = {
        "ema_fast": [10, 20],
        "ema_slow": [50, 100],
        "ema_trend": [200],
        "rsi_period": [7, 14, 21],
        "macd_fast": [8, 12],
        "macd_slow": [21, 26],
        "macd_signal": [5, 9],
        "adx_period": [14, 21],
        "atr_period": [14],
        "volume_ma": [20],
    }

    def __init__(self) -> None:
        self.binance_base_url = os.getenv("BINANCE_BASE_URL", "https://api.binance.com").rstrip("/")
        self.klines_url = f"{self.binance_base_url}/api/v3/klines"
        self.ticker_url = f"{self.binance_base_url}/api/v3/ticker/24hr"

    @classmethod
    def _param_combinations(cls) -> list[dict[str, int]]:
        keys = list(cls.PARAM_GRID.keys())
        combos = itertools.product(*(cls.PARAM_GRID[key] for key in keys))
        return [dict(zip(keys, combo, strict=False)) for combo in combos]

    def fetch_historical(self, pair: str, timeframe: str, limit: int = 1000) -> pd.DataFrame:
        normalized_pair = normalize_pair(pair)
        normalized_timeframe = normalize_timeframe(timeframe)
        time.sleep(0.1)
        response = _SESSION.get(
            self.klines_url,
            params={"symbol": normalized_pair, "interval": TIMEFRAME_TO_INTERVAL[normalized_timeframe], "limit": min(max(int(limit), 500), 1000)},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list) or len(payload) < 500:
            return pd.DataFrame()
        frame = pd.DataFrame(payload, columns=["timestamp", "open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_base", "taker_quote", "ignore"])
        for column in ("open", "high", "low", "close", "volume"):
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], unit="ms", utc=True)
        frame = frame[["timestamp", "open", "high", "low", "close", "volume"]].dropna().reset_index(drop=True)
        return frame if len(frame) >= 500 else pd.DataFrame()

    def compute_indicators(self, df: pd.DataFrame, params: dict[str, int]) -> pd.DataFrame:
        frame = df.copy().reset_index(drop=True)
        if frame.empty:
            return frame

        frame["ema_fast"] = frame["close"].ewm(span=params["ema_fast"], adjust=False).mean()
        frame["ema_slow"] = frame["close"].ewm(span=params["ema_slow"], adjust=False).mean()
        frame["ema_trend"] = frame["close"].ewm(span=params["ema_trend"], adjust=False).mean()

        if pta is not None:
            frame["rsi"] = pta.rsi(frame["close"], length=params["rsi_period"])
            macd = pta.macd(frame["close"], fast=params["macd_fast"], slow=params["macd_slow"], signal=params["macd_signal"])
            if macd is not None and not macd.empty:
                frame["macd"] = macd.iloc[:, 0]
                frame["macd_signal"] = macd.iloc[:, 1]
                frame["macd_histogram"] = macd.iloc[:, 2]
            frame["adx"] = pta.adx(frame["high"], frame["low"], frame["close"], length=params["adx_period"]).iloc[:, 0]
            frame["atr"] = pta.atr(frame["high"], frame["low"], frame["close"], length=params["atr_period"])
        elif ta is not None:
            frame["rsi"] = ta.momentum.RSIIndicator(close=frame["close"], window=params["rsi_period"]).rsi()
            macd = ta.trend.MACD(close=frame["close"], window_fast=params["macd_fast"], window_slow=params["macd_slow"], window_sign=params["macd_signal"])
            frame["macd"] = macd.macd()
            frame["macd_signal"] = macd.macd_signal()
            frame["macd_histogram"] = macd.macd_diff()
            frame["adx"] = ta.trend.ADXIndicator(high=frame["high"], low=frame["low"], close=frame["close"], window=params["adx_period"]).adx()
            frame["atr"] = ta.volatility.AverageTrueRange(high=frame["high"], low=frame["low"], close=frame["close"], window=params["atr_period"]).average_true_range()
        else:
            frame["rsi"] = _manual_rsi(frame["close"], params["rsi_period"])
            ema_fast = frame["close"].ewm(span=params["macd_fast"], adjust=False).mean()
            ema_slow = frame["close"].ewm(span=params["macd_slow"], adjust=False).mean()
            frame["macd"] = ema_fast - ema_slow
            frame["macd_signal"] = frame["macd"].ewm(span=params["macd_signal"], adjust=False).mean()
            frame["macd_histogram"] = frame["macd"] - frame["macd_signal"]
            frame["adx"] = _manual_adx(frame, params["adx_period"])
            frame["atr"] = _manual_atr(frame, params["atr_period"])

        frame["volume_ma"] = frame["volume"].rolling(window=params["volume_ma"], min_periods=params["volume_ma"]).mean()
        frame["volume_ratio"] = frame["volume"] / frame["volume_ma"].replace(0, np.nan)
        return frame.dropna().reset_index(drop=True)

    def generate_signals(self, df: pd.DataFrame, params: dict[str, int]) -> pd.DataFrame:
        frame = df.copy()
        if frame.empty:
            return frame
        frame["signal"] = ""
        long_mask = (
            (frame["ema_fast"] > frame["ema_slow"])
            & (frame["ema_slow"] > frame["ema_trend"])
            & (frame["rsi"] < 70)
            & (frame["rsi"] > 45)
            & (frame["macd"] > frame["macd_signal"])
            & (frame["adx"] > 25)
        )
        short_mask = (
            (frame["ema_fast"] < frame["ema_slow"])
            & (frame["ema_slow"] < frame["ema_trend"])
            & (frame["rsi"] > 30)
            & (frame["rsi"] < 55)
            & (frame["macd"] < frame["macd_signal"])
            & (frame["adx"] > 25)
        )
        frame.loc[long_mask, "signal"] = "long"
        frame.loc[short_mask, "signal"] = "short"
        frame["entry"] = np.where(frame["signal"] != "", frame["close"], np.nan)
        frame["sl"] = np.where(
            frame["signal"] == "long",
            frame["entry"] - (frame["atr"] * 1.5),
            np.where(frame["signal"] == "short", frame["entry"] + (frame["atr"] * 1.5), np.nan),
        )
        frame["tp"] = np.where(
            frame["signal"] == "long",
            frame["entry"] + (frame["atr"] * 2.5),
            np.where(frame["signal"] == "short", frame["entry"] - (frame["atr"] * 2.5), np.nan),
        )
        return frame

    def backtest(self, df: pd.DataFrame) -> dict[str, float | int]:
        signals = df[df["signal"].isin(["long", "short"])].copy()
        if signals.empty:
            return {
                "win_rate": 0.0,
                "total_signals": 0,
                "win_count": 0,
                "loss_count": 0,
                "avg_win_pct": 0.0,
                "avg_loss_pct": 0.0,
                "profit_factor": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown_pct": 0.0,
            }

        results: list[float] = []
        wins: list[float] = []
        losses: list[float] = []

        for idx in signals.index:
            row = df.loc[idx]
            future = df.iloc[idx + 1 : idx + 201]
            if future.empty:
                continue
            signal = row["signal"]
            entry = float(row["entry"])
            sl = float(row["sl"])
            tp = float(row["tp"])
            outcome_return = 0.0

            for _, candle in future.iterrows():
                high = float(candle["high"])
                low = float(candle["low"])
                if signal == "long":
                    sl_hit = low <= sl
                    tp_hit = high >= tp
                    if sl_hit and tp_hit:
                        outcome_return = ((sl - entry) / entry) * 100.0
                        break
                    if sl_hit:
                        outcome_return = ((sl - entry) / entry) * 100.0
                        break
                    if tp_hit:
                        outcome_return = ((tp - entry) / entry) * 100.0
                        break
                else:
                    sl_hit = high >= sl
                    tp_hit = low <= tp
                    if sl_hit and tp_hit:
                        outcome_return = ((entry - sl) / entry) * 100.0
                        break
                    if sl_hit:
                        outcome_return = ((entry - sl) / entry) * 100.0
                        break
                    if tp_hit:
                        outcome_return = ((entry - tp) / entry) * 100.0
                        break

            results.append(outcome_return)
            if outcome_return > 0:
                wins.append(outcome_return)
            elif outcome_return < 0:
                losses.append(outcome_return)

        total_signals = len(results)
        if total_signals == 0:
            return {
                "win_rate": 0.0,
                "total_signals": 0,
                "win_count": 0,
                "loss_count": 0,
                "avg_win_pct": 0.0,
                "avg_loss_pct": 0.0,
                "profit_factor": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown_pct": 0.0,
            }

        win_count = len(wins)
        loss_count = len(losses)
        returns = np.array(results, dtype=float)
        cumulative = np.cumprod(1 + (returns / 100.0))
        running_max = np.maximum.accumulate(np.where(cumulative > 0, cumulative, 1e-9))
        drawdowns = (cumulative / running_max) - 1
        std = float(np.std(returns, ddof=1)) if total_signals > 1 else 0.0
        sharpe_ratio = float((np.mean(returns) / std) * np.sqrt(total_signals)) if std > 0 else 0.0
        total_win = float(sum(wins))
        total_loss = abs(float(sum(losses)))
        profit_factor = total_win / total_loss if total_loss > 0 else float("inf") if total_win > 0 else 0.0

        return {
            "win_rate": round(win_count / total_signals, 4),
            "total_signals": total_signals,
            "win_count": win_count,
            "loss_count": loss_count,
            "avg_win_pct": round(float(np.mean(wins)) if wins else 0.0, 4),
            "avg_loss_pct": round(float(np.mean(losses)) if losses else 0.0, 4),
            "profit_factor": round(profit_factor if math.isfinite(profit_factor) else 999.0, 4),
            "sharpe_ratio": round(sharpe_ratio, 4),
            "max_drawdown_pct": round(abs(float(np.min(drawdowns))) * 100.0 if len(drawdowns) else 0.0, 4),
        }

    @staticmethod
    def _evaluate_combo(args: tuple[pd.DataFrame, dict[str, int]]) -> OptimizationCandidate | None:
        df, params = args
        optimizer = ParameterOptimizer()
        indicator_df = optimizer.compute_indicators(df, params)
        signal_df = optimizer.generate_signals(indicator_df, params)
        metrics = optimizer.backtest(signal_df)
        if int(metrics["total_signals"]) < 30:
            return None
        return OptimizationCandidate(params=params, metrics=metrics)

    def grid_search(
        self,
        pair: str,
        timeframe: str,
        *,
        df: pd.DataFrame | None = None,
        processes: int | None = None,
    ) -> dict[str, Any]:
        base_df = df.copy() if df is not None else self.fetch_historical(pair, timeframe)
        if base_df.empty or len(base_df) < 500:
            return {"best_params": DEFAULT_PARAMS.copy(), "metrics": {}, "all_results": []}

        combinations = self._param_combinations()
        worker_count = processes or max(1, min(4, os.cpu_count() or 1))
        candidates: list[OptimizationCandidate] = []

        if len(combinations) > 1 and worker_count > 1:
            try:
                with get_context("spawn").Pool(processes=worker_count) as pool:
                    for item in pool.imap_unordered(self._evaluate_combo, [(base_df, combo) for combo in combinations]):
                        if item is not None:
                            candidates.append(item)
            except Exception as exc:
                logger.warning("optimizer multiprocessing fallback for %s %s: %s", pair, timeframe, exc)
                for combo in combinations:
                    item = self._evaluate_combo((base_df, combo))
                    if item is not None:
                        candidates.append(item)
        else:
            for combo in combinations:
                item = self._evaluate_combo((base_df, combo))
                if item is not None:
                    candidates.append(item)

        all_results = [{"params": item.params, "metrics": item.metrics} for item in candidates]
        all_results.sort(
            key=lambda item: (
                float(item["metrics"].get("profit_factor", 0.0)),
                float(item["metrics"].get("win_rate", 0.0)),
                float(item["metrics"].get("sharpe_ratio", 0.0)),
            ),
            reverse=True,
        )
        if not all_results:
            return {"best_params": DEFAULT_PARAMS.copy(), "metrics": {}, "all_results": []}
        best = all_results[0]
        return {"best_params": dict(best["params"]), "metrics": dict(best["metrics"]), "all_results": all_results}

    def walk_forward(self, pair: str, timeframe: str, n_splits: int = 4) -> dict[str, Any]:
        df = self.fetch_historical(pair, timeframe)
        if df.empty or len(df) < 500:
            return {
                "pair": normalize_pair(pair),
                "timeframe": normalize_timeframe(timeframe),
                "best_params": DEFAULT_PARAMS.copy(),
                "in_sample_metrics": {},
                "out_of_sample_metrics": {},
                "overfitting_score": 0.0,
                "overfitting_flag": False,
                "splits": [],
            }

        split_frames = np.array_split(df.reset_index(drop=True), n_splits + 1)
        split_results: list[dict[str, Any]] = []
        oos_metrics: list[dict[str, float | int]] = []
        in_sample_metrics: list[dict[str, float | int]] = []
        final_best_params = DEFAULT_PARAMS.copy()

        for split_index in range(n_splits):
            train_chunks = split_frames[: split_index + 1]
            train_df = pd.concat(train_chunks, ignore_index=True)
            if len(train_df) < max(350, int(len(df) * 0.7 / n_splits)):
                continue
            train_cutoff = int(len(train_df) * 0.7)
            train_data = train_df.iloc[:train_cutoff].reset_index(drop=True)
            test_data = train_df.iloc[train_cutoff:].reset_index(drop=True)
            if len(train_data) < 250 or len(test_data) < 100:
                continue

            search = self.grid_search(pair, timeframe, df=train_data, processes=1)
            best_params = dict(search.get("best_params") or DEFAULT_PARAMS)
            final_best_params = best_params

            test_indicator_df = self.compute_indicators(test_data, best_params)
            test_signal_df = self.generate_signals(test_indicator_df, best_params)
            oos = self.backtest(test_signal_df)
            oos_metrics.append(oos)
            in_sample_metrics.append(dict(search.get("metrics") or {}))
            split_results.append({"split": split_index + 1, "best_params": best_params, "train_metrics": search.get("metrics", {}), "test_metrics": oos})

        def _avg_metrics(items: list[dict[str, float | int]]) -> dict[str, float]:
            if not items:
                return {}
            keys = ("win_rate", "profit_factor", "sharpe_ratio", "max_drawdown_pct", "avg_win_pct", "avg_loss_pct", "total_signals")
            averages: dict[str, float] = {}
            for key in keys:
                values = [float(item.get(key, 0.0)) for item in items if item.get(key) is not None]
                averages[key] = round(float(np.mean(values)) if values else 0.0, 4)
            return averages

        avg_in_sample = _avg_metrics(in_sample_metrics)
        avg_out_of_sample = _avg_metrics(oos_metrics)
        overfitting_score = round(float(avg_in_sample.get("win_rate", 0.0) - avg_out_of_sample.get("win_rate", 0.0)), 4)
        overfitting_flag = overfitting_score > 0.15

        return {
            "pair": normalize_pair(pair),
            "timeframe": normalize_timeframe(timeframe),
            "best_params": final_best_params,
            "in_sample_metrics": avg_in_sample,
            "out_of_sample_metrics": avg_out_of_sample,
            "overfitting_score": overfitting_score,
            "overfitting_flag": overfitting_flag,
            "splits": split_results,
        }

    def fetch_most_active_pairs(self, limit: int | None = 20) -> list[str]:
        response = _SESSION.get(self.ticker_url, timeout=20)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            return []
        pairs = []
        for item in payload:
            symbol = str(item.get("symbol", "")).upper()
            if symbol.endswith("USDT") and symbol.isalnum():
                try:
                    quote_volume = float(item.get("quoteVolume", 0) or 0.0)
                except (TypeError, ValueError):
                    quote_volume = 0.0
                pairs.append((symbol, quote_volume))
        pairs.sort(key=lambda entry: entry[1], reverse=True)
        if limit is None or limit <= 0:
            return [symbol for symbol, _ in pairs]
        return [symbol for symbol, _ in pairs[:limit]]

    def optimize_all(self) -> dict[str, Any]:
        limit_raw = int(os.getenv("OPTIMIZER_ACTIVE_PAIR_LIMIT", "0"))
        pairs = self.fetch_most_active_pairs(limit=limit_raw if limit_raw > 0 else None)
        timeframes = list(TIMEFRAME_TO_INTERVAL.keys())
        stored = 0
        results: list[dict[str, Any]] = []
        for pair in pairs:
            for timeframe in timeframes:
                try:
                    search = self.grid_search(pair, timeframe)
                    best_params = dict(search.get("best_params") or DEFAULT_PARAMS)
                    metrics = dict(search.get("metrics") or {})
                    if not metrics:
                        continue
                    record = upsert_optimized_result(pair, timeframe, best_params, metrics, overfitting_flag=False)
                    if record is not None:
                        stored += 1
                    results.append({"pair": pair, "timeframe": timeframe, "best_params": best_params, "metrics": metrics})
                except Exception as exc:
                    logger.exception("optimize_all failed for %s %s: %s", pair, timeframe, exc)
        return {"optimized_pairs": len(pairs), "stored_records": stored, "results": results}
