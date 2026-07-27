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
from .algorithms import ALGORITHM_BY_ID, CATEGORIES, algorithms_by_category
from .dataset import (
    SAMPLE_DATASET_ID,
    SAMPLE_MARKDOWN_DATASET_ID,
    get_sample_dataset,
    get_sample_markdown_dataset,
    parse_csv,
    parse_markdown_rules,
)
from .executor import run_pipeline
from .recommendations import build_recommendations

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


@app.get("/algorithms")
def list_algorithm_categories(full: bool = False) -> dict[str, Any]:
    from .algorithms import REGISTRY
    if full:
        return {"categories": CATEGORIES, "algorithms": REGISTRY}
    return {"categories": CATEGORIES}


@app.get("/algorithms/{key}")
def get_algorithms(key: str, full: bool = True) -> dict[str, Any]:
    """Dispatch on the single path segment:
    - if `key` matches an algorithm id, return that algorithm's full detail
    - otherwise treat `key` as a category and return the algorithm list
    """
    algo = ALGORITHM_BY_ID.get(key)
    if algo:
        return {"algorithm": algo}
    if key in CATEGORIES:
        return {"category": key, "algorithms": algorithms_by_category(key, full=full)}
    return {"error": "unknown algorithm or category", "key": key}


@app.get("/datasets/sample")
def sample_dataset() -> dict[str, Any]:
    ds = get_sample_dataset()
    return {
        "id": ds["id"],
        "name": ds["name"],
        "source": ds["source"],
        "row_count": ds["row_count"],
    }


@app.get("/datasets/sample-markdown")
def sample_markdown_dataset() -> dict[str, Any]:
    ds = get_sample_markdown_dataset()
    return {
        "id": ds["id"],
        "name": ds["name"],
        "source": ds["source"],
        "row_count": ds["row_count"],
    }


class PipelineSaveRequest(BaseModel):
    id: str | None = None
    name: str
    description: str | None = None
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


@app.get("/pipelines")
@app.get("/api/pipelines")
def list_db_pipelines() -> dict[str, Any]:
    pipes = db.list_pipelines()
    if not pipes:
        # Seed default pipeline
        default_pipe = db.save_pipeline(
            pipeline_id="pipe-md-rules-clustering",
            name="Markdown Rules & HDBSCAN Clustering Pipeline",
            nodes=[
                {
                    "id": "n1",
                    "type": "pipeline",
                    "position": {"x": 250, "y": 120},
                    "data": {
                        "category": "input",
                        "defType": "input.markdown-rules",
                        "label": "Markdown Rules (.md)",
                        "description": "Dynamic rule AST ingestion",
                        "params": {"fileName": "RULE_PARAMETER_MAPPING.md"},
                    },
                },
                {
                    "id": "n2",
                    "type": "pipeline",
                    "position": {"x": 250, "y": 280},
                    "data": {
                        "category": "feature",
                        "defType": "feat.engineering",
                        "label": "Mutual Information Selection",
                        "algorithmId": "feat.mi-selection",
                        "description": "Select top informative signals",
                    },
                },
                {
                    "id": "n3",
                    "type": "pipeline",
                    "position": {"x": 250, "y": 440},
                    "data": {
                        "category": "detection",
                        "defType": "det.clustering",
                        "detectionSubType": "clustering",
                        "label": "HDBSCAN Clustering",
                        "algorithmId": "det.cluster.hdbscan",
                        "description": "Clusters uploaded rules by feature matrix",
                    },
                },
            ],
            edges=[
                {"id": "e1", "source": "n1", "target": "n2"},
                {"id": "e2", "source": "n2", "target": "n3"},
            ],
            description="Dynamic Markdown Rule-to-Cluster execution pipeline.",
        )
        pipes = [default_pipe]
    return {"pipelines": pipes}


@app.post("/pipelines")
@app.post("/api/pipelines")
def save_db_pipeline(req: PipelineSaveRequest) -> dict[str, Any]:
    pipe_id = req.id or f"pipe-{uuid.uuid4().hex[:8]}"
    saved = db.save_pipeline(
        pipeline_id=pipe_id,
        name=req.name,
        nodes=req.nodes,
        edges=req.edges,
        description=req.description,
    )
    return {"status": "ok", "pipeline": saved}


@app.get("/pipelines/{pipeline_id}")
@app.get("/api/pipelines/{pipeline_id}")
def get_db_pipeline(pipeline_id: str) -> dict[str, Any]:
    pipe = db.get_pipeline(pipeline_id)
    if not pipe:
        return {"error": "Pipeline not found", "id": pipeline_id}
    return {"pipeline": pipe}


@app.delete("/pipelines/{pipeline_id}")
@app.delete("/api/pipelines/{pipeline_id}")
def delete_db_pipeline(pipeline_id: str) -> dict[str, Any]:
    ok = db.delete_pipeline(pipeline_id)
    return {"status": "ok" if ok else "error", "deleted": ok}


@app.post("/datasets/upload")
@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read()
    filename = file.filename or "upload.csv"
    if filename.endswith(".md") or filename.endswith(".markdown"):
        ds = parse_markdown_rules(content, filename)
    else:
        ds = parse_csv(content, filename)
    ds_id = f"upload-{uuid.uuid4().hex[:8]}"
    db.insert_dataset(
        ds_id,
        ds["name"],
        ds["source"],
        ds["row_count"],
        datetime.now(timezone.utc).isoformat(),
        rows_json=json.dumps(ds["rows"]),
    )
    return {"id": ds_id, "name": ds["name"], "row_count": ds["row_count"], "source": ds["source"]}


@app.post("/pipelines/{pipeline_id}/execute")
@app.post("/api/pipelines/{pipeline_id}/execute")
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
    elif dataset_ref == SAMPLE_MARKDOWN_DATASET_ID or dataset_ref == "sample-md-rules-001":
        dataset_rows = get_sample_markdown_dataset()["rows"]
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
@app.websocket("/api/ws/executions/{exec_id}")
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
@app.get("/api/executions/{exec_id}")
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


class RecommendRequest(BaseModel):
    pipeline: dict[str, Any]
    summary: dict[str, Any]


class ComparisonRequest(BaseModel):
    pipelines: list[dict[str, Any]]
    dataset_ref: str | None = None


@app.post("/pipelines/compare")
@app.post("/api/pipelines/compare")
async def compare_pipelines(body: ComparisonRequest) -> dict[str, Any]:
    """Run 2-3 pipelines against the same dataset and return each one's summary."""
    if not body.pipelines:
        return {"results": []}

    dataset_rows: list[dict[str, Any]] | None = None
    if body.dataset_ref == SAMPLE_DATASET_ID:
        dataset_rows = get_sample_dataset()["rows"]
    elif body.dataset_ref and body.dataset_ref.startswith("upload-"):
        ds = db.get_dataset(body.dataset_ref)
        if ds and ds.get("rows"):
            dataset_rows = ds["rows"]  # type: ignore[assignment]

    out: list[dict[str, Any]] = []
    for pipe in body.pipelines:
        summary: dict[str, Any] | None = None
        error: str | None = None
        try:
            async for msg in run_pipeline(pipe, body.dataset_ref, dataset_rows, None, None):
                if msg.get("type") == "complete":
                    summary = msg["results"]["summary"]
                elif msg.get("type") == "error":
                    error = msg.get("message")
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
        out.append({
            "pipeline_id": pipe.get("id"),
            "pipeline_name": pipe.get("name"),
            "summary": summary,
            "error": error,
        })
    return {"results": out}


@app.post("/pipelines/recommendations")
@app.post("/api/pipelines/recommendations")
def recommendations(body: RecommendRequest) -> dict[str, Any]:
    """Rule-based suggested optimizations for a completed pipeline run."""
    return {"suggestions": build_recommendations(body.pipeline, body.summary)}


@app.get("/executions")
@app.get("/api/executions")
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


class PredictRequest(BaseModel):
    pipeline: dict[str, Any]
    transaction: dict[str, Any]


@app.post("/api/pipeline/predict")
async def predict_pipeline(req: PredictRequest) -> dict[str, Any]:
    """Execute live real-time inference on an incoming transaction using the configured pipeline."""
    import time
    from .markdown_rule_engine import parse_markdown_rules_ast

    start_t = time.monotonic()
    pipeline = req.pipeline
    txn = req.transaction

    nodes = pipeline.get("nodes", []) or []
    custom_md_text: str | None = None
    custom_rule_clusters: dict[str, str] = {}

    for n in nodes:
        params = n.get("data", {}).get("params") or {}
        if params.get("rawMarkdown"):
            custom_md_text = params["rawMarkdown"]
        if params.get("customRuleClusters"):
            custom_rule_clusters = params["customRuleClusters"]

    triggered_rules: list[str] = []
    matched_clusters: list[str] = []

    if custom_md_text:
        rules_ast = parse_markdown_rules_ast(custom_md_text)
        txn_keys = [str(k).lower() for k in txn.keys()]
        
        for r in rules_ast:
            # Match rule if transaction specifies parameters or passes threshold
            param_matches = [p for p in r.parameters if any(pk in p.lower() or p.lower() in pk for pk in txn_keys)]
            amt = float(txn.get("amount", 0) or 0)
            if param_matches or amt > 800 or r.risk_level == "HIGH":
                triggered_rules.append(r.rule_id)
                cluster_name = custom_rule_clusters.get(r.rule_id, f"Cluster for {r.rule_id[:12]}")
                if cluster_name not in matched_clusters:
                    matched_clusters.append(cluster_name)

    amt = float(txn.get("amount", 0) or 0)
    is_fraud = len(triggered_rules) >= 2 or amt > 2500 or any("RISK_" in tr or "FRAUD" in tr for tr in triggered_rules)
    base_score = 0.25 * len(triggered_rules) + (0.5 if is_fraud else 0.05)
    risk_score = round(min(0.99, max(0.01, base_score)), 4)
    elapsed_ms = round((time.monotonic() - start_t) * 1000, 2)

    decision = "BLOCK" if risk_score >= 0.8 else ("CHALLENGE" if risk_score >= 0.45 else "ALLOW")

    return {
        "is_fraud": is_fraud,
        "risk_score": risk_score,
        "decision": decision,
        "triggered_rules": triggered_rules,
        "matched_clusters": matched_clusters,
        "execution_time_ms": elapsed_ms,
        "transaction_id": str(txn.get("transaction_id") or f"txn_live_{uuid.uuid4().hex[:6]}"),
    }
