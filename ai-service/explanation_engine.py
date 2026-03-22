from __future__ import annotations

import os
from typing import Any

import requests


def _level_phrase(label: str, value: Any) -> str | None:
    try:
        if value is None:
            return None
        return f"{label} near {float(value):.2f}"
    except (TypeError, ValueError):
        return None


def _bias_phrase(trend: str, regime: str, flags: list[str]) -> str:
    if trend == "Strong Bullish":
        phrase = "Bullish structure remains firmly intact."
    elif trend == "Bullish":
        phrase = "The market continues to lean bullish."
    elif trend == "Strong Bearish":
        phrase = "Bearish pressure remains firmly in control."
    elif trend == "Bearish":
        phrase = "The market continues to lean bearish."
    else:
        phrase = "The market is trading without a strong directional bias."

    if regime in {"Range-Bound", "Low Participation"} or "choppy_structure" in flags:
        if trend in {"Strong Bullish", "Bullish"}:
            return "The market is tilted higher, but overall direction remains less decisive."
        if trend in {"Strong Bearish", "Bearish"}:
            return "The market is tilted lower, but conviction remains limited."
        return "The market lacks clear direction for now."
    return phrase


def _reliability_phrase(risk: str, flags: list[str], regime: str) -> str:
    remarks: list[str] = []
    if "low_volume" in flags:
        remarks.append("participation remains thin")
    elif "weak_volume_confirmation" in flags:
        remarks.append("follow-through still looks limited")

    if "mtf_conflict" in flags:
        remarks.append("signals are mixed across timeframes")
    elif "mtf_aligned" in flags:
        remarks.append("the broader structure remains aligned across timeframes")

    if "high_volatility" in flags:
        remarks.append("price action remains volatile")
    if "stale_data" in flags:
        remarks.append("the latest read should be treated with extra caution")
    if "weak_trend_strength" in flags:
        remarks.append("trend strength is still fragile")
    if regime in {"Range-Bound", "Low Participation"} and "choppy_structure" not in flags:
        remarks.append("the market still lacks clear direction")

    if not remarks:
        if risk == "High":
            return "Reliability remains weaker than usual as market conditions stay fragile."
        if risk == "Low":
            return "Conditions look relatively orderly, with no major warning signs in the current structure."
        return "Conditions are mixed, but the current structure remains usable as a market read."

    first_two = remarks[:2]
    if len(first_two) == 1:
        return first_two[0].capitalize() + "."
    return f"{first_two[0].capitalize()}, and {first_two[1]}."


def _levels_phrase(levels: dict[str, Any]) -> str:
    support_text = _level_phrase("support", levels.get("support"))
    resistance_text = _level_phrase("resistance", levels.get("resistance"))
    if support_text and resistance_text:
        return (
            f"Support near {float(levels['support']):.2f} remains the key downside reference, "
            f"while resistance near {float(levels['resistance']):.2f} is the level that would help stabilize the structure."
        )
    if support_text:
        return f"Support near {float(levels['support']):.2f} remains the key level to watch next."
    if resistance_text:
        return f"Resistance near {float(levels['resistance']):.2f} remains the key level to watch next."
    return "Nearby support and resistance levels remain less clearly defined."


def templated_insight(analysis: dict[str, Any]) -> str:
    trend = str(analysis.get("trend", "Neutral"))
    risk = str(analysis.get("risk", "Medium"))
    regime = str(analysis.get("market_regime", "Range-Bound"))
    levels = analysis.get("levels") or {}
    support_text = _level_phrase("support", levels.get("support"))
    resistance_text = _level_phrase("resistance", levels.get("resistance"))
    quality_flags = [str(flag) for flag in (analysis.get("quality_flags") or [])]

    sentences = [
        _bias_phrase(trend, regime, quality_flags),
        _reliability_phrase(risk, quality_flags, regime),
    ]
    if support_text or resistance_text:
        sentences.append(_levels_phrase(levels))
    return " ".join(" ".join(sentences).split())


def templated_explanation(analysis: dict[str, Any]) -> str:
    trend = analysis.get("trend", "Neutral")
    momentum = analysis.get("momentum", "Moderate").lower()
    risk = analysis.get("risk", "Medium").lower()
    regime = str(analysis.get("market_regime", "Range-Bound")).lower()
    confidence = analysis.get("confidence", "n/a")
    scenario = analysis.get("scenario", "")
    return (
        f"{trend} structure with {momentum} momentum and {risk} risk, backed by a deterministic confidence score of {confidence}/100. "
        f"The market is currently {regime}. {scenario}"
    ).strip()


def _llm_enabled() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _generate_text(analysis: dict[str, Any], *, mode: str) -> str:
    fallback = templated_insight(analysis) if mode == "insight" else templated_explanation(analysis)
    if not _llm_enabled():
        return fallback

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    task = "market insight" if mode == "insight" else "market analysis explanation"
    prompt = (
        f"You are writing a short professional crypto {task}. "
        "Use the deterministic input as the source of truth. "
        "Do not give financial advice. "
        "Do not use buy, sell, long, short, guaranteed, or hype language. "
        "Do not mention internal metrics like confidence scores or raw scoring fields. "
        "Do not sound robotic, repetitive, or templated. "
        "Write 2 to 4 concise sentences in natural, fluent English with a confident but measured tone. "
        "Start with market bias and strength, then comment on reliability using risk, volume, and flags, then mention the next important levels. "
        "Use phrasing like 'conviction remains limited', 'participation remains thin', 'market lacks clear direction', 'signals are mixed across timeframes', or 'structure remains intact' when appropriate. "
        "Return plain text only.\n\n"
        f"Deterministic analysis: {analysis}"
    )

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "temperature": 0.2,
                "max_tokens": 140,
                "messages": [
                    {
                        "role": "system",
                        "content": "Explain deterministic market analysis like a human analyst: concise, natural, conservative, and never advisory.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            },
            timeout=10,
        )
        if response.status_code != 200:
            return fallback
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        return content or fallback
    except Exception:
        return fallback


def generate_insight(analysis: dict[str, Any]) -> str:
    return _generate_text(analysis, mode="insight")


def generate_endpoint_insight(analysis: dict[str, Any]) -> str:
    fallback = templated_insight(analysis)

    if not _llm_enabled():
        return fallback

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    prompt = (
        "You are writing a short professional crypto market insight from structured analysis. "
        "Use the provided deterministic signal as the source of truth. "
        "Do not override the signal. "
        "Do not give financial advice. "
        "Do not use buy, sell, long, short, guaranteed, or hype language. "
        "Do not mention internal metrics like confidence scores or raw scoring fields. "
        "Do not sound robotic or templated. "
        "Write 2 to 4 concise sentences in natural, fluent English. "
        "Start with the market bias and strength, then comment on reliability using risk, volume, and flags, then mention what matters next using support and resistance. "
        "Use ideas such as 'conviction remains limited', 'participation remains thin', 'lack of strong follow-through', 'market lacks clear direction', 'signals are mixed across timeframes', or 'structure remains intact' when appropriate. "
        "Return plain text only.\n\n"
        f"Structured signal payload: {analysis}"
    )

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "temperature": 0.2,
                "max_tokens": 140,
                "messages": [
                    {
                        "role": "system",
                        "content": "Write like a professional market analyst: natural, concise, conservative, and never advisory.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            },
            timeout=10,
        )
        if response.status_code != 200:
            return fallback
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        return content or fallback
    except Exception:
        return fallback


def generate_explanation(analysis: dict[str, Any]) -> str:
    return _generate_text(analysis, mode="explanation")
