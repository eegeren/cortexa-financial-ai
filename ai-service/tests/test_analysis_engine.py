from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from analysis_engine import (  # noqa: E402
    build_analysis,
    build_indicator_frame,
    risk_label,
    score_row,
    trend_label,
)


def sample_frame(length: int = 260, *, drift: float = 1.0, volatility: float = 0.5) -> pd.DataFrame:
    rows = []
    price = 100.0
    for index in range(length):
        price += drift
        high = price + volatility
        low = price - volatility
        close = price + (0.1 if index % 2 == 0 else -0.1)
        rows.append(
            {
                "time": 1_700_000_000_000 + index * 3_600_000,
                "open": price - 0.2,
                "high": high,
                "low": low,
                "close": close,
                "volume": 1000 + index * 5,
            }
        )
    return pd.DataFrame(rows)


class AnalysisEngineTests(unittest.TestCase):
    def test_confidence_is_clamped(self):
        frame = build_indicator_frame(sample_frame())
        latest = frame.iloc[-1]
        scoring = score_row(latest)
        self.assertGreaterEqual(scoring["confidence"], 0)
        self.assertLessEqual(scoring["confidence"], 100)

    def test_trend_label_mapping(self):
        self.assertEqual(trend_label(20), "Bearish")
        self.assertEqual(trend_label(45), "Neutral")
        self.assertEqual(trend_label(72), "Bullish")
        self.assertEqual(trend_label(91), "Strong Bullish")

    def test_risk_label_mapping(self):
        frame = build_indicator_frame(sample_frame())
        row = frame.iloc[-1].copy()
        row["atr_pct"] = 0.01
        row["adx"] = 28
        self.assertEqual(risk_label(row), "Low")
        row["atr_pct"] = 0.03
        self.assertEqual(risk_label(row), "Medium")
        row["atr_pct"] = 0.07
        self.assertEqual(risk_label(row), "High")

    def test_response_structure_contains_required_keys(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="BTCUSDT", timeframe="1h")
        for key in (
            "symbol",
            "timeframe",
            "trend",
            "momentum",
            "risk",
            "confidence",
            "market_regime",
            "price",
            "indicators",
            "levels",
            "scenario",
            "explanation",
            "disclaimer",
        ):
            self.assertIn(key, analysis)

    def test_indicator_snapshot_uses_core_ema_fields(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="ETHUSDT", timeframe="4h")
        indicators = analysis["indicators"]
        self.assertIn("ema20", indicators)
        self.assertIn("ema50", indicators)
        self.assertIn("ema200", indicators)
        self.assertIn("macd", indicators)


if __name__ == "__main__":
    unittest.main()
