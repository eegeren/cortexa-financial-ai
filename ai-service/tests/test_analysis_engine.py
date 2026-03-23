from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from analysis_engine import (  # noqa: E402
    build_analysis,
    build_indicator_frame,
    confidence_from_raw_score,
    risk_label,
    score_row,
    trend_bias,
    trend_label,
)
from explanation_engine import generate_endpoint_insight, templated_insight  # noqa: E402
from signal_api import (  # noqa: E402
    SUPPORTED_SYMBOLS,
    SUPPORTED_TIMEFRAMES,
    apply_market_quality_filters,
    analysis_payload,
    parse_predict_payload,
    validate_symbol,
    validate_timeframe,
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
        self.assertGreaterEqual(scoring["confidence"], 16)
        self.assertLessEqual(scoring["confidence"], 90)

    def test_confidence_mapping_preserves_non_zero_bearish_conviction(self):
        self.assertEqual(confidence_from_raw_score(0), 16)
        self.assertEqual(confidence_from_raw_score(50), 50)
        self.assertEqual(confidence_from_raw_score(100), 84)

    def test_trend_label_mapping(self):
        self.assertEqual(trend_label(16), "Strong Bearish")
        self.assertEqual(trend_label(18), "Bearish")
        self.assertEqual(trend_label(20), "Bearish")
        self.assertEqual(trend_label(35), "Bearish")
        self.assertEqual(trend_label(45), "Neutral")
        self.assertEqual(trend_label(72), "Bullish")
        self.assertEqual(trend_label(91), "Strong Bullish")

    def test_risk_label_mapping(self):
        frame = build_indicator_frame(sample_frame())
        row = frame.iloc[-1].copy()
        row["atr_pct"] = 0.01
        row["adx"] = 28
        row["volume_ratio"] = 1.2
        self.assertEqual(risk_label(row), "Low")
        row["atr_pct"] = 0.03
        self.assertEqual(risk_label(row), "Medium")
        row["atr_pct"] = 0.07
        self.assertEqual(risk_label(row), "Medium")
        row["atr_pct"] = 0.08
        self.assertEqual(risk_label(row), "High")
        row["atr_pct"] = 0.01
        row["volume_ratio"] = 0.6
        self.assertEqual(risk_label(row), "Medium")
        row["volume_ratio"] = 0.55
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
            "insight",
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

    def test_symbol_validation_allows_supported_symbol(self):
        self.assertEqual(validate_symbol("btcusdt"), "BTCUSDT")
        self.assertIn("BTCUSDT", SUPPORTED_SYMBOLS)

    def test_timeframe_validation_allows_supported_timeframe(self):
        self.assertEqual(validate_timeframe("1H"), "1h")
        self.assertIn("1h", SUPPORTED_TIMEFRAMES)
        self.assertNotIn("15m", SUPPORTED_TIMEFRAMES)

    def test_supported_symbols_are_restricted_to_major_liquid_pairs(self):
        self.assertEqual(SUPPORTED_SYMBOLS, ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"])

    def test_predict_payload_parses_symbol_and_timeframe(self):
        symbol, timeframe = parse_predict_payload({"symbol": "ethusdt", "timeframe": "4H"})
        self.assertEqual(symbol, "ETHUSDT")
        self.assertEqual(timeframe, "4h")

    def test_trend_bias_mapping(self):
        self.assertEqual(trend_bias("Strong Bearish"), -2)
        self.assertEqual(trend_bias("Bearish"), -1)
        self.assertEqual(trend_bias("Neutral"), 0)
        self.assertEqual(trend_bias("Bullish"), 1)
        self.assertEqual(trend_bias("Strong Bullish"), 2)

    def test_market_quality_filter_caps_choppy_low_volume_conditions(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="BTCUSDT", timeframe="1h")
        latest = frame.iloc[-1].copy()
        latest["volume_ratio"] = 0.55
        latest["atr_pct"] = 0.081
        latest["adx"] = 16
        analysis["market_regime"] = "Range-Bound"
        analysis["confidence"] = 79
        analysis["trend"] = trend_label(analysis["confidence"])

        filtered = apply_market_quality_filters(analysis, latest, stale=True, higher_timeframe_trend="Bearish")
        self.assertEqual(filtered["trend"], "Neutral")
        self.assertGreaterEqual(filtered["confidence"], 16)
        self.assertIn("low_volume", filtered["quality_flags"])
        self.assertIn("stale_data", filtered["quality_flags"])
        self.assertIn("weak_trend_strength", filtered["quality_flags"])

    def test_low_edge_direction_is_neutralized_by_quality_first_rules(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="BTCUSDT", timeframe="1h")
        latest = frame.iloc[-1].copy()
        latest["volume_ratio"] = 0.7
        latest["atr_pct"] = 0.03
        latest["adx"] = 21
        analysis["market_regime"] = "Trending"
        analysis["confidence"] = 74
        analysis["trend"] = "Bullish"

        filtered = apply_market_quality_filters(analysis, latest, timeframe="1h", stale=False, higher_timeframe_trend=None)
        self.assertEqual(filtered["trend"], "Neutral")
        self.assertIn("low_volume", filtered["quality_flags"])
        self.assertIn("weak_trend_strength", filtered["quality_flags"])

    def test_strong_bullish_requires_strict_confirmation_set(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="BTCUSDT", timeframe="1h")
        latest = frame.iloc[-1].copy()
        latest["ema20"] = 108
        latest["ema50"] = 104
        latest["ema200"] = 99
        latest["close"] = 110
        latest["macd"] = 2.1
        latest["macd_signal"] = 1.2
        latest["macd_histogram"] = 0.9
        latest["rsi"] = 61
        latest["adx"] = 28
        latest["volume_ratio"] = 1.08
        analysis["confidence"] = 81
        analysis["risk"] = "Low"
        analysis["market_regime"] = "Trending"

        filtered = apply_market_quality_filters(analysis, latest, timeframe="1h", stale=False, higher_timeframe_trend="Bullish")
        self.assertEqual(filtered["trend"], "Strong Bullish")
        self.assertGreaterEqual(filtered["scoring"]["bullish_confirmations"], 5)
        self.assertIn("mtf_aligned", filtered["quality_flags"])

    def test_exhaustion_guard_blocks_bullish_output(self):
        frame = build_indicator_frame(sample_frame())
        analysis = build_analysis(frame, symbol="BTCUSDT", timeframe="1h")
        latest = frame.iloc[-1].copy()
        latest["ema20"] = 108
        latest["ema50"] = 104
        latest["ema200"] = 99
        latest["close"] = 110
        latest["macd"] = 2.1
        latest["macd_signal"] = 1.2
        latest["macd_histogram"] = 0.9
        latest["rsi"] = 74
        latest["adx"] = 28
        latest["volume_ratio"] = 1.08
        analysis["confidence"] = 81
        analysis["risk"] = "Low"
        analysis["market_regime"] = "Trending"

        filtered = apply_market_quality_filters(analysis, latest, timeframe="1h", stale=False, higher_timeframe_trend="Bullish")
        self.assertEqual(filtered["trend"], "Neutral")

    def test_analysis_payload_uses_wrapped_schema(self):
        with patch(
            "signal_api.compute_analysis",
            return_value={
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "trend": "Neutral",
                "momentum": "Moderate",
                "risk": "Medium",
                "confidence": 50,
                "market_regime": "Range-Bound",
                "price": 100.0,
                "indicators": {},
                "levels": {"support": 95.0, "resistance": 105.0},
                "scenario": "Range conditions persist.",
                "explanation": "Range conditions persist.",
                "disclaimer": "This is not financial advice. It is an informational market analysis.",
                "scoring": {
                    "trend": 0,
                    "momentum": 0,
                    "trend_strength": 0,
                    "volume_confirmation": 0,
                    "risk_adjustment": 0,
                    "raw_score": 50.0,
                },
                "ai_validated": None,
                "ai_setup_quality": "medium",
                "ai_validation_reason": "AI validation unavailable; deterministic fallback used.",
                "ai_confidence_adjustment": 0,
                "stale": False,
            },
        ):
            payload = analysis_payload("BTCUSDT", "1h")
        self.assertTrue(payload["ok"])
        self.assertIn("data", payload)
        self.assertIn("stale", payload)
        self.assertNotIn("trend", payload)

    def test_ai_validation_can_reject_setup_without_breaking_payload(self):
        frame = build_indicator_frame(sample_frame())
        with patch(
            "signal_api.validate_signal_setup",
            return_value={"valid_setup": False, "setup_quality": "low", "confidence_adjustment": -8, "reason": "Low participation and mixed confirmation."},
        ):
            with patch("signal_api.fetch_ohlcv_with_meta", return_value=(sample_frame(), False)):
                analysis = __import__("signal_api").compute_analysis("BTCUSDT", "1h")
        self.assertEqual(analysis["trend"], "Neutral")
        self.assertFalse(analysis["ai_validated"])
        self.assertEqual(analysis["ai_setup_quality"], "low")
        self.assertEqual(analysis["ai_confidence_adjustment"], -8)
        self.assertIn("mixed confirmation", analysis["ai_validation_reason"].lower())

    def test_ai_validation_can_accept_and_slightly_adjust_confidence(self):
        with patch(
            "signal_api.validate_signal_setup",
            return_value={"valid_setup": True, "setup_quality": "high", "confidence_adjustment": 3, "reason": "Structure remains internally consistent."},
        ):
            with patch("signal_api.fetch_ohlcv_with_meta", return_value=(sample_frame(), False)):
                analysis = __import__("signal_api").compute_analysis("BTCUSDT", "1h")
        self.assertTrue(analysis["ai_validated"])
        self.assertEqual(analysis["ai_setup_quality"], "high")
        self.assertEqual(analysis["ai_confidence_adjustment"], 3)
        self.assertIn("consistent", analysis["ai_validation_reason"].lower())

    def test_ai_validation_medium_quality_keeps_direction(self):
        with patch(
            "signal_api.validate_signal_setup",
            return_value={"valid_setup": True, "setup_quality": "medium", "confidence_adjustment": 0, "reason": "Setup is usable but not exceptional."},
        ):
            with patch("signal_api.fetch_ohlcv_with_meta", return_value=(sample_frame(), False)):
                analysis = __import__("signal_api").compute_analysis("BTCUSDT", "1h")
        self.assertEqual(analysis["ai_setup_quality"], "medium")
        self.assertIn(analysis["trend"], {"Neutral", "Bullish", "Bearish", "Strong Bullish", "Strong Bearish"})

    def test_generate_endpoint_insight_returns_text(self):
        insight = generate_endpoint_insight(
            {
                "trend": "Bearish",
                "confidence": 31,
                "risk": "Medium",
                "market_regime": "Range-Bound",
                "levels": {"support": 61234, "resistance": 62810},
                "quality_flags": ["weak_volume_confirmation", "choppy_structure"],
                "scenario": "Price remains below its short-term trend anchors.",
            }
        )
        self.assertTrue(isinstance(insight, str) and insight.strip())

    def test_templated_insight_avoids_confidence_score_language(self):
        insight = templated_insight(
            {
                "trend": "Bearish",
                "confidence": 31,
                "risk": "Medium",
                "market_regime": "Range-Bound",
                "levels": {"support": 61234, "resistance": 62810},
                "quality_flags": ["weak_volume_confirmation", "choppy_structure"],
            }
        )
        self.assertNotIn("/100", insight)
        self.assertNotIn("confidence score", insight.lower())


if __name__ == "__main__":
    unittest.main()
