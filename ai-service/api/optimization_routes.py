from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from services.optimizer import ParameterOptimizer, list_optimized_status, load_optimized_record


logger = logging.getLogger("ai-service.optimization_routes")
router = APIRouter(prefix="/api/optimization", tags=["optimization"])
JOB_REGISTRY: dict[str, dict[str, Any]] = {}


def _require_admin_token(authorization: str | None, x_admin_key: str | None) -> None:
    configured = os.getenv("OPTIMIZER_ADMIN_KEY", "").strip()
    if not configured:
        return
    bearer = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()
    candidate = bearer or (x_admin_key or "").strip()
    if candidate != configured:
        raise HTTPException(status_code=403, detail="admin access required")


def _run_job(job_id: str) -> None:
    job = JOB_REGISTRY[job_id]
    optimizer = ParameterOptimizer()
    job["status"] = "running"
    job["started_at"] = time.time()
    try:
        summary = optimizer.optimize_all()
        job["status"] = "completed"
        job["result"] = summary
        job["completed_at"] = time.time()
    except Exception as exc:
        logger.exception("manual optimizer job failed: %s", exc)
        job["status"] = "failed"
        job["error"] = str(exc)
        job["completed_at"] = time.time()


@router.get("/status")
def optimization_status():
    rows = list_optimized_status()
    items = [
        {
            "pair": row.get("pair"),
            "timeframe": row.get("timeframe"),
            "win_rate": row.get("win_rate"),
            "profit_factor": row.get("profit_factor"),
            "optimized_at": row.get("optimized_at"),
            "param_source": row.get("param_source", "optimized"),
        }
        for row in rows
    ]
    return {"ok": True, "items": items}


@router.post("/run")
def optimization_run(
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None),
):
    _require_admin_token(authorization, x_admin_key)
    job_id = str(uuid.uuid4())
    JOB_REGISTRY[job_id] = {"job_id": job_id, "status": "pending", "created_at": time.time()}
    background_tasks.add_task(_run_job, job_id)
    return {"ok": True, "job_id": job_id, "status": "pending"}


@router.get("/job/{job_id}")
def optimization_job(job_id: str):
    job = JOB_REGISTRY.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return {"ok": True, **job}


@router.get("/{pair}/{timeframe}")
def optimization_detail(pair: str, timeframe: str):
    record = load_optimized_record(pair, timeframe)
    if not record:
        return {"ok": True, "pair": pair.upper(), "timeframe": timeframe.lower(), "params": None, "metrics": None, "param_source": "default"}
    return {
        "ok": True,
        "pair": record.get("pair", pair.upper()),
        "timeframe": record.get("timeframe", timeframe.lower()),
        "params": record.get("params"),
        "metrics": {
            "win_rate": record.get("win_rate"),
            "profit_factor": record.get("profit_factor"),
            "sharpe_ratio": record.get("sharpe_ratio"),
            "max_drawdown_pct": record.get("max_drawdown_pct"),
            "total_signals": record.get("total_signals"),
            "overfitting_flag": record.get("overfitting_flag"),
        },
        "optimized_at": record.get("optimized_at"),
        "param_source": record.get("param_source", "optimized"),
    }
