"""Minimal backtest scaffolding."""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List


@dataclass
class Trade:
    timestamp: str
    side: str
    price: float
    qty: float


@dataclass
class Metrics:
    total_pnl: float
    trades: int


class Backtest:
    def __init__(self, equity: float = 10_000.0):
        self.equity = equity
        self.trades: List[Trade] = []
        self.pnl = 0.0

    def record(self, trade: Trade) -> None:
        self.trades.append(trade)
        direction = 1 if trade.side.upper() == "BUY" else -1
        self.pnl += direction * trade.qty * trade.price

    def metrics(self) -> Metrics:
        return Metrics(total_pnl=self.pnl, trades=len(self.trades))

    def export_trades(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "side", "price", "qty"])
            for t in self.trades:
                writer.writerow([t.timestamp, t.side, f"{t.price:.2f}", f"{t.qty:.6f}"])
