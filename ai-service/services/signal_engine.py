from __future__ import annotations

import logging
from typing import Any

from services.optimizer import DEFAULT_PARAMS, load_optimized_record, normalize_pair, normalize_timeframe


logger = logging.getLogger("ai-service.signal_engine")


def get_params(pair: str, timeframe: str) -> tuple[dict[str, int], str]:
    normalized_pair = normalize_pair(pair)
    normalized_timeframe = normalize_timeframe(timeframe)

    record = load_optimized_record(normalized_pair, normalized_timeframe)
    if record and isinstance(record.get("params"), dict):
        try:
            return {**DEFAULT_PARAMS, **{key: int(value) for key, value in record["params"].items()}}, "optimized"
        except Exception:
            logger.warning("get_params invalid optimized payload for %s %s", normalized_pair, normalized_timeframe)

    return DEFAULT_PARAMS.copy(), "default"


def enrich_signal_with_params(signal: dict[str, Any], pair: str, timeframe: str) -> dict[str, Any]:
    params, source = get_params(pair, timeframe)
    updated = dict(signal)
    updated["params"] = params
    updated["param_source"] = source
    return updated
