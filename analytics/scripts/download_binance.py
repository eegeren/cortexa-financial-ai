"""Command-line helper to download Binance klines into analytics/data/raw."""
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

from analytics.data.binance import download_history, save_to_csv


def parse_date(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Binance spot klines")
    parser.add_argument("symbol", help="Trading pair, e.g. BTCUSDT")
    parser.add_argument("interval", help="Kline interval, e.g. 1h, 15m, 4h")
    parser.add_argument("start", type=parse_date, help="Start datetime (ISO format)")
    parser.add_argument("end", type=parse_date, help="End datetime (ISO format)")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("analytics/data/raw"),
        help="Output directory (default: analytics/data/raw)",
    )
    args = parser.parse_args()

    klines = download_history(args.symbol, args.interval, start=args.start, end=args.end)
    outfile = args.out / f"{args.symbol.lower()}_{args.interval}_{args.start:%Y%m%d}_{args.end:%Y%m%d}.csv"
    save_to_csv(klines, outfile)
    print(f"Saved {len(klines)} rows to {outfile}")


if __name__ == "__main__":
    main()
