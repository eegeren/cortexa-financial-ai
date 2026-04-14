from __future__ import annotations

import logging
import os
from statistics import mean
from typing import Any

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from services.optimizer import ParameterOptimizer, clear_optimization_cache, load_optimized_record, upsert_optimized_result


logger = logging.getLogger("ai-service.weekly_optimizer")
_SCHEDULER: BackgroundScheduler | None = None


def _send_alarm(message: str) -> None:
    webhook = os.getenv("OPTIMIZER_ALERT_WEBHOOK_URL", "").strip()
    if not webhook:
        logger.error("optimizer alarm: %s", message)
        return
    try:
        requests.post(webhook, json={"text": message}, timeout=10)
    except Exception as exc:
        logger.error("optimizer alarm delivery failed: %s", exc)


def run_weekly_optimization() -> dict[str, Any]:
    optimizer = ParameterOptimizer()
    timeframes = ["1h", "4h", "1d"]
    pairs = optimizer.fetch_most_active_pairs(limit=20)
    optimized = 0
    win_rate_deltas: list[float] = []
    failures: list[str] = []

    for pair in pairs:
        for timeframe in timeframes:
            previous = load_optimized_record(pair, timeframe)
            try:
                walk_forward = optimizer.walk_forward(pair, timeframe, n_splits=4)
                params = dict(walk_forward.get("best_params") or {})
                metrics = dict(walk_forward.get("out_of_sample_metrics") or {})
                if not params or not metrics:
                    continue
                upsert_optimized_result(
                    pair,
                    timeframe,
                    params,
                    metrics,
                    overfitting_flag=bool(walk_forward.get("overfitting_flag", False)),
                )
                optimized += 1
                old_win_rate = float(previous.get("win_rate", 0.0)) if previous else 0.0
                new_win_rate = float(metrics.get("win_rate", 0.0))
                win_rate_deltas.append(new_win_rate - old_win_rate)
            except Exception as exc:
                failures.append(f"{pair}:{timeframe}:{exc}")
                logger.exception("weekly optimization failed for %s %s: %s", pair, timeframe, exc)

    cleared = clear_optimization_cache()
    summary = {
        "optimized_pairs": optimized,
        "pair_count": len(pairs),
        "cache_keys_cleared": cleared,
        "average_win_rate_change": round(mean(win_rate_deltas), 4) if win_rate_deltas else 0.0,
        "failures": failures,
    }

    logger.info(
        "weekly_optimizer completed optimized=%s pair_count=%s avg_win_rate_change=%.4f cache_cleared=%s",
        optimized,
        len(pairs),
        summary["average_win_rate_change"],
        cleared,
    )
    if failures:
        _send_alarm(f"Weekly optimizer completed with {len(failures)} failures: {' | '.join(failures[:5])}")
    return summary


def start_weekly_optimizer_scheduler() -> BackgroundScheduler | None:
    global _SCHEDULER
    if _SCHEDULER is not None:
        return _SCHEDULER
    if os.getenv("ENABLE_WEEKLY_OPTIMIZER", "true").strip().lower() not in {"1", "true", "yes", "on"}:
        logger.info("weekly optimizer scheduler disabled by environment")
        return None
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run_weekly_optimization, CronTrigger(day_of_week="sun", hour=2, minute=0), id="weekly_optimizer", replace_existing=True)
    scheduler.start()
    _SCHEDULER = scheduler
    logger.info("weekly optimizer scheduler started for Sunday 02:00 UTC")
    return scheduler


def stop_weekly_optimizer_scheduler() -> None:
    global _SCHEDULER
    if _SCHEDULER is not None:
        _SCHEDULER.shutdown(wait=False)
        _SCHEDULER = None
