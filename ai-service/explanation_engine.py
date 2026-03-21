from __future__ import annotations

import os
from typing import Any

import requests


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


def generate_explanation(analysis: dict[str, Any]) -> str:
    if not _llm_enabled():
        return templated_explanation(analysis)

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    prompt = (
        "You are writing a short professional crypto market analysis explanation. "
        "Use the deterministic input as the source of truth. "
        "Do not give financial advice. "
        "Do not use buy, sell, long, short, guaranteed, or hype language. "
        "Limit the answer to 2 concise sentences.\n\n"
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
                "max_tokens": 120,
                "messages": [
                    {
                        "role": "system",
                        "content": "Explain deterministic market analysis clearly and conservatively.",
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
            return templated_explanation(analysis)
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        return content or templated_explanation(analysis)
    except Exception:
        return templated_explanation(analysis)
