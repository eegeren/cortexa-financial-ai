"""Lightweight Binance spot data downloader."""
from __future__ import annotations

import csv
import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

import requests
from tqdm import tqdm

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"


@dataclass
class Kline:
    open_time: dt.datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_time: dt.datetime

    def to_row(self) -> List[str]:
        return [
            self.open_time.isoformat(),
            f"{self.open:.8f}",
            f"{self.high:.8f}",
            f"{self.low:.8f}",
            f"{self.close:.8f}",
            f"{self.volume:.8f}",
            self.close_time.isoformat(),
        ]


def fetch_klines(symbol: str, interval: str, limit: int = 500, end_time: Optional[int] = None) -> List[Kline]:
    params = {
        "symbol": symbol.upper(),
        "interval": interval,
        "limit": limit,
    }
    if end_time is not None:
        params["endTime"] = end_time

    resp = requests.get(BINANCE_KLINES, params=params, timeout=10)
    resp.raise_for_status()
    raw = resp.json()

    klines: List[Kline] = []
    for k in raw:
        open_time = dt.datetime.utcfromtimestamp(k[0] / 1000)
        close_time = dt.datetime.utcfromtimestamp(k[6] / 1000)
        klines.append(
            Kline(
                open_time=open_time,
                open=float(k[1]),
                high=float(k[2]),
                low=float(k[3]),
                close=float(k[4]),
                volume=float(k[5]),
                close_time=close_time,
            )
        )
    return klines


def download_history(
    symbol: str,
    interval: str,
    start: dt.datetime,
    end: dt.datetime,
    chunk: int = 1000,
    sleep: float = 0.0,
) -> List[Kline]:
    result: List[Kline] = []
    cursor = end
    pbar = tqdm(total=(end - start).total_seconds(), desc=f"{symbol} {interval}")
    while cursor > start:
        batch = fetch_klines(symbol, interval, limit=chunk, end_time=int(cursor.timestamp() * 1000))
        if not batch:
            break
        result = batch + result
        oldest = batch[0].open_time
        cursor = oldest - dt.timedelta(milliseconds=1)
        pbar.update(len(batch) * interval_to_seconds(interval))
    pbar.close()
    return [k for k in result if start <= k.open_time <= end]


def interval_to_seconds(interval: str) -> int:
    unit = interval[-1]
    value = int(interval[:-1])
    mapping = {
        "m": 60,
        "h": 3600,
        "d": 86400,
    }
    if unit not in mapping:
        raise ValueError(f"Unsupported interval: {interval}")
    return value * mapping[unit]


def save_to_csv(klines: Iterable[Kline], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["open_time", "open", "high", "low", "close", "volume", "close_time"])
        for k in klines:
            writer.writerow(k.to_row())


def save_to_json(klines: Iterable[Kline], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = [
        {
            "open_time": k.open_time.isoformat(),
            "open": k.open,
            "high": k.high,
            "low": k.low,
            "close": k.close,
            "volume": k.volume,
            "close_time": k.close_time.isoformat(),
        }
        for k in klines
    ]
    path.write_text(json.dumps(data, indent=2))
