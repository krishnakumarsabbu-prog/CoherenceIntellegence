"""CoherenceIQ backend — FastAPI + SQLite + WebSockets.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import db
from .dataset import SAMPLE_DATASET_ID, get_sample_dataset, parse_csv
from .executor import run_pipeline

app = FastAPI(title="CoherenceIQ Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# execution_id -> live asyncio queue for connected websocket clients + replay buffer
_live_queues: dict[str, set[asyncio.Queue]] = {}
_replay: dict[str, list[dict[str, Any]]] = {}
# execution_id -> final results (in-memory cache; SQLite is source of truth)
_results_cache: dict[str, dict[str, Any]] = {}
# execution_id -> running task
_tasks: dict[str, asyncio.Task] = {}


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


class ExecuteRequest(BaseModel):
    pipeline_id: str
    pipeline_name: str
    pipeline: dict[str, Any]
    dataset_ref: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/datasets/sample")
def sample_dataset() -> dict[str, Any]:
    ds = get_sample_dataset()
    return {
        "id": ds["id"],
        "name": ds["name"],
        "source": ds["source"],
        "row_count": ds["row_count"],
    }


@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read()
    ds = parse_csv(content, file.filename or "upload.csv")
    ds_id = f"upload-{uuid.uuid4().hex[:8]}"
    db.insert_dataset(
        ds_id,
        ds["name"],
        "upload",
        ds["row_count"],
        datetime.now(timezone.utc).isoformat(),
        rows_json=json.dumps(ds["rows"]),
    )
    return {"id": ds_id, "name": ds["name"], "row_count": ds["row_count"], "source": "upload"}


@app.post("/pipelines/{pipeline_id}/execute")
async def execute_pipeline(pipeline_id: str, body: ExecuteRequest) -> dict[str, Any]:
    exec_id = f"exec-{uuid.uuid4().hex[:12]}"
    started_at = datetime.now(timezone.utc).isoformat()
    db.insert_execution(
        exec_id,
        pipeline_id,
        body.pipeline_name,
        body.pipeline,
        body.dataset_ref,
        started_at,
        started_at,
    )
    _replay[exec_id] = []
    _results_cache.pop(exec_id, None)
    task = asyncio.create_task(_run_execution(exec_id, body.pipeline, body.dataset_ref))
    _tasks[exec_id] = task
    return {"execution_id": exec_id, "status": "queued", "started_at": started_at}


async def _run_execution(
    exec_id: str,
    pipeline: dict[str, Any],
    dataset_ref: str | None,
) -> None:
    dataset_rows: list[dict[str, Any]] | None = None
    if dataset_ref == SAMPLE_DATASET_ID:
        dataset_rows = get_sample_dataset()["rows"]
    elif dataset_ref and dataset_ref.startswith("upload-"):
        ds = db.get_dataset(dataset_ref)
        if ds and ds.get("rows"):
            dataset_rows = ds["rows"]  # type: ignore[assignment]

    db.update_execution_status(exec_id, "running")
    try:
        async for msg in run_pipeline(pipeline, dataset_ref, dataset_rows, None, None):
            _replay.setdefault(exec_id, []).append(msg)
            _broadcast(exec_id, msg)
            if msg.get("type") == "complete":
                results = msg["results"]
                _results_cache[exec_id] = results
                db.update_execution_status(
                    exec_id,
                    "completed",
                    datetime.now(timezone.utc).isoformat(),
                    results["summary"],
                )
    except Exception as exc:  # noqa: BLE001
        err_msg = {
            "type": "error",
            "message": f"Execution failed: {exc}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _replay.setdefault(exec_id, []).append(err_msg)
        _broadcast(exec_id, err_msg)
        db.update_execution_status(
            exec_id,
            "failed",
            datetime.now(timezone.utc).isoformat(),
            {"error": str(exc)},
        )
    finally:
        _tasks.pop(exec_id, None)


def _broadcast(exec_id: str, msg: dict[str, Any]) -> None:
    for q in _live_queues.get(exec_id, set()):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass


@app.websocket("/ws/executions/{exec_id}")
async def execution_ws(websocket: WebSocket, exec_id: str) -> None:
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
    _live_queues.setdefault(exec_id, set()).add(queue)
    try:
        # Replay buffered messages so a late client sees full history.
        for msg in _replay.get(exec_id, []):
            await websocket.send_text(json.dumps(msg))
        # If already complete, nothing more to stream.
        if exec_id in _results_cache:
            return
        while True:
            msg = await queue.get()
            await websocket.send_text(json.dumps(msg))
            if msg.get("type") in ("complete", "error"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        _live_queues.get(exec_id, set()).discard(queue)


@app.get("/executions/{exec_id}")
def get_execution(exec_id: str) -> dict[str, Any] | None:
    row = db.get_execution(exec_id)
    if not row:
        return None
    out: dict[str, Any] = {
        "id": row["id"],
        "pipeline_id": row["pipeline_id"],
        "pipeline_name": row["pipeline_name"],
        "status": row["status"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "summary": row.get("summary"),
        "pipeline": row.get("pipeline_json"),
    }
    if exec_id in _results_cache:
        out["results"] = _results_cache[exec_id]
    return out


@app.get("/executions")
def list_executions(limit: int = 50) -> dict[str, Any]:
    rows = db.list_executions(limit)
    return {
        "executions": [
            {
                "id": r["id"],
                "pipeline_id": r["pipeline_id"],
                "pipeline_name": r["pipeline_name"],
                "status": r["status"],
                "started_at": r["started_at"],
                "completed_at": r["completed_at"],
                "summary": r.get("summary"),
            }
            for r in rows
        ],
        "total": db.count_executions(),
        "distinct_pipelines": db.count_distinct_pipelines(),
    }
