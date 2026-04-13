from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from validation import SUPPORTED_VALIDATION_HORIZONS, analysis_history, validate_analysis_history  # noqa: E402


def sample_frame(length: int = 320, *, drift: float = 0.35, volatility: float = 0.8) -> pd.DataFrame:
    rows = []
    price = 100.0
    for index in range(length):
        price += drift + (0.2 if index % 7 == 0 else -0.05)
        high = price + volatility
        low = price - volatility
        close = price + (0.12 if index % 2 == 0 else -0.08)
        rows.append(
            {
                "time": 1_700_000_000_000 + index * 3_600_000,
                "open": price - 0.2,
                "high": high,
                "low": low,
                "close": close,
                "volume": 1200 + index * 4,
            }
        )
    return pd.DataFrame(rows)


class ValidationTests(unittest.TestCase):
    def test_analysis_history_includes_multi_horizon_returns(self):
        history = analysis_history(sample_frame(), "BTCUSDT", "1h")
        self.assertFalse(history.empty)
        for horizon in SUPPORTED_VALIDATION_HORIZONS:
            self.assertIn(f"future_return_{horizon}", history.columns)
        self.assertIn("final_score", history.columns)
        self.assertIn("quality_flags", history.columns)
        self.assertIn("coin_profile", history.columns)

    def test_validate_analysis_history_returns_bucket_metrics_and_samples(self):
        result = validate_analysis_history(
            sample_frame(),
            symbol="BTCUSDT",
            timeframe="1h",
            threshold=0.6,
            horizon=4,
            commission_bps=4.0,
            slippage_bps=1.0,
            position_size=1.0,
        )
        self.assertIn("total_samples", result)
        self.assertIn("overall_directional_accuracy", result)
        self.assertIn("confidence_buckets", result)
        self.assertIn("score_buckets", result)
        self.assertIn("setup_quality_buckets", result)
        self.assertIn("coin_profile_metrics", result)
        self.assertIn("sample_rows", result)
        self.assertEqual(result["available_horizons"], [1, 4, 12])
        self.assertEqual(len(result["confidence_buckets"]), 5)
        self.assertEqual(len(result["score_buckets"]), 5)
        self.assertEqual(result["coin_profile"], "high_quality")

    def test_sample_rows_include_required_validation_fields(self):
        result = validate_analysis_history(
            sample_frame(),
            symbol="ETHUSDT",
            timeframe="4h",
            threshold=0.5,
            horizon=1,
            commission_bps=4.0,
            slippage_bps=1.0,
            position_size=1.0,
        )
        self.assertTrue(result["sample_rows"])
        row = result["sample_rows"][-1]
        for key in (
            "timestamp",
            "symbol",
            "timeframe",
            "signal_direction",
            "confidence",
            "raw_score",
            "final_score",
            "risk",
            "market_regime",
            "quality_flags",
            "coin_profile",
            "ai_setup_quality",
            "entry_price",
            "future_return",
            "future_return_1",
            "future_return_4",
            "future_return_12",
            "directional_accuracy",
        ):
            self.assertIn(key, row)

    def test_backtest_can_disable_ai_validation(self):
        result = validate_analysis_history(
            sample_frame(),
            symbol="SOLUSDT",
            timeframe="4h",
            threshold=0.5,
            horizon=4,
            commission_bps=4.0,
            slippage_bps=1.0,
            position_size=1.0,
            use_ai_validation=False,
        )
        self.assertFalse(result["use_ai_validation"])
        self.assertEqual(result["coin_profile"], "mid_quality")


if __name__ == "__main__":
    unittest.main()
