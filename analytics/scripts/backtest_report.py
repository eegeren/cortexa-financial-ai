"""Generate automated backtest report via the HTTP API.

Usage:

    python analytics/scripts/backtest_report.py \
        --symbols BTCUSDT ETHUSDT \
        --thresholds 0.5 0.6 0.7 \
        --horizons 4 6 \
        --token $CORTEXA_API_TOKEN

The script calls the /api/signals/{symbol}/backtest/sweep endpoint for each
symbol and stores the aggregated summary as JSON (default under
`reports/backtest_report_<timestamp>.json`).

This helps monitor accuracy automatically – e.g. schedule it nightly with cron.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
from typing import Iterable

import requests


DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
DEFAULT_THRESHOLDS = [0.5, 0.6, 0.7]
DEFAULT_HORIZONS = [2, 4, 6]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate backtest accuracy report")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("CORTEXA_API_BASE", "http://localhost:8080"),
        help="Root URL of the backend API",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("CORTEXA_API_TOKEN"),
        help="JWT token for authenticated requests (env CORTEXA_API_TOKEN)",
    )
    parser.add_argument(
        "--symbols",
        nargs="*",
        default=DEFAULT_SYMBOLS,
        help="Symbols to evaluate (default: %(default)s)",
    )
    parser.add_argument(
        "--thresholds",
        nargs="*",
        type=float,
        default=DEFAULT_THRESHOLDS,
        help="Threshold levels to sweep (default: %(default)s)",
    )
    parser.add_argument(
        "--horizons",
        nargs="*",
        type=int,
        default=DEFAULT_HORIZONS,
        help="Forward return horizons to test (default: %(default)s)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=400,
        help="Number of historical bars for the backtest window",
    )
    parser.add_argument(
        "--commission-bps",
        type=float,
        default=4.0,
        help="Commission in basis points",
    )
    parser.add_argument(
        "--slippage-bps",
        type=float,
        default=1.0,
        help="Slippage in basis points",
    )
    parser.add_argument(
        "--position-size",
        type=float,
        default=1.0,
        help="Position size multiplier",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output JSON path (default: reports/backtest_report_<timestamp>.json)",
    )
    return parser.parse_args()


def join_values(values: Iterable[float | int]) -> str:
    return ",".join(str(v) for v in values)


def run_sweep(
    base_url: str,
    token: str,
    symbol: str,
    thresholds: list[float],
    horizons: list[int],
    limit: int,
    commission_bps: float,
    slippage_bps: float,
    position_size: float,
) -> dict:
    url = f"{base_url.rstrip('/')}/api/signals/{symbol}/backtest/sweep"
    params = {
        "thresholds": join_values(thresholds),
        "horizons": join_values(horizons),
        "limit": limit,
        "commission_bps": commission_bps,
        "slippage_bps": slippage_bps,
        "position_size": position_size,
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, params=params, headers=headers, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"Sweep failed for {symbol} ({response.status_code}): {response.text}")
    return response.json()


def summarise(symbol: str, payload: dict) -> dict:
    results = payload.get("results", [])
    if not results:
        return {
            "symbol": symbol,
            "trades": 0,
            "hit_rate": 0.0,
            "best": None,
        }

    def sort_key(item: dict) -> float:
        return item.get("net_value_sum", 0.0)

    sorted_results = sorted(results, key=sort_key, reverse=True)
    best = sorted_results[0]
    return {
        "symbol": symbol,
        "trades": best.get("trades", 0),
        "hit_rate": best.get("hit_rate", 0.0),
        "net_value_sum": best.get("net_value_sum", 0.0),
        "net_return_sum": best.get("net_return_sum", 0.0),
        "threshold": best.get("threshold"),
        "horizon": best.get("horizon"),
        "sharpe": best.get("sharpe"),
        "sortino": best.get("sortino"),
        "max_drawdown": best.get("max_drawdown"),
        "avg_win": best.get("avg_win"),
        "avg_loss": best.get("avg_loss"),
    }


def main() -> None:
    args = parse_args()
    if not args.token:
        raise SystemExit("JWT token is required (set --token or CORTEXA_API_TOKEN)")

    report_time = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    output_path = (
        Path(args.output)
        if args.output
        else Path("reports") / f"backtest_report_{report_time.replace(':', '-')}.json"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    summary_rows = []
    raw_payloads: dict[str, dict] = {}
    for symbol in args.symbols:
        payload = run_sweep(
            args.base_url,
            args.token,
            symbol,
            args.thresholds,
            args.horizons,
            args.limit,
            args.commission_bps,
            args.slippage_bps,
            args.position_size,
        )
        raw_payloads[symbol] = payload
        summary_rows.append(summarise(symbol, payload))

    report = {
        "generated_at": report_time,
        "base_url": args.base_url,
        "symbols": args.symbols,
        "thresholds": args.thresholds,
        "horizons": args.horizons,
        "limit": args.limit,
        "commission_bps": args.commission_bps,
        "slippage_bps": args.slippage_bps,
        "position_size": args.position_size,
        "summary": summary_rows,
        "raw": raw_payloads,
    }

    output_path.write_text(json.dumps(report, indent=2))

    print(f"Backtest report written to {output_path}")
    for row in summary_rows:
        print(
            f"{row['symbol']}: net={row.get('net_value_sum', 0):.2f} hit_rate={row.get('hit_rate', 0)*100:.1f}%"
            f" best threshold={row.get('threshold')} horizon={row.get('horizon')}"
        )


if __name__ == "__main__":
    main()
