"""SQLite persistence for executions and uploaded datasets."""
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Any

DB_PATH = os.environ.get("COHERENCEIQ_DB", os.path.join(os.path.dirname(__file__), "..", "data", "coherenceiq.db"))

_lock = threading.RLock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
    except Exception:
        pass
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _lock, get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                pipeline_id TEXT NOT NULL,
                pipeline_name TEXT NOT NULL,
                pipeline_json TEXT NOT NULL,
                dataset_ref TEXT,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                summary_json TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_exec_started ON executions(started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_exec_pipeline ON executions(pipeline_id);

            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                path TEXT,
                rows_json TEXT
            );

            CREATE TABLE IF NOT EXISTS pipelines (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                nodes_json TEXT NOT NULL,
                edges_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        _seed_mega_pipeline(conn)


def _seed_mega_pipeline(conn: sqlite3.Connection) -> None:
    """Ensure the Enterprise Fraud & Risk Mega Pipeline exists in database."""
    mega_id = "pipe_enterprise_mega_001"
    row = conn.execute("SELECT id FROM pipelines WHERE id = ?", (mega_id,)).fetchone()
    if row:
        return

    now = datetime.now(timezone.utc).isoformat()
    nodes = [
        {
            "id": "node_md_rules",
            "type": "pipeline",
            "position": {"x": 50, "y": 100},
            "data": {
                "label": "Markdown Business Rules (.md)",
                "category": "input",
                "defType": "input.markdown-rules",
                "description": "Ingests structured business rules and parameter specifications from a Markdown file (.md).",
            },
        },
        {
            "id": "node_tx_feed",
            "type": "pipeline",
            "position": {"x": 50, "y": 280},
            "data": {
                "label": "Real-Time Transaction Stream",
                "category": "input",
                "defType": "input.transaction-feed",
                "description": "Streams incoming live credit card and digital payment transactions.",
            },
        },
        {
            "id": "node_pre_cleaning",
            "type": "pipeline",
            "position": {"x": 320, "y": 190},
            "data": {
                "label": "Data Cleaning & Type Validation",
                "category": "preprocessing",
                "algorithmId": "pre.cleaning",
                "defType": "pre.cleaning",
                "description": "Cleans raw records, validates currency formats, and trims string whitespace.",
                "params": {"strip_strings": True, "coerce_numeric": True},
            },
        },
        {
            "id": "node_pre_missing",
            "type": "pipeline",
            "position": {"x": 580, "y": 190},
            "data": {
                "label": "Median Missing Value Imputation",
                "category": "preprocessing",
                "algorithmId": "pre.missing-values",
                "defType": "pre.missing-values",
                "description": "Fills missing transaction attributes using median feature imputation.",
                "params": {"strategy": "median"},
            },
        },
        {
            "id": "node_feat_mi",
            "type": "pipeline",
            "position": {"x": 840, "y": 190},
            "data": {
                "label": "Mutual Information Feature Selection",
                "category": "feature",
                "algorithmId": "feat.mi-selection",
                "defType": "feat.engineering",
                "description": "Derives entropy dependencies and selects non-linear feature signals.",
                "params": {"n_neighbors": 3},
            },
        },
        {
            "id": "node_det_hdbscan",
            "type": "pipeline",
            "position": {"x": 1120, "y": 90},
            "data": {
                "label": "HDBSCAN Hierarchical Clustering",
                "category": "detection",
                "detectionSubType": "clustering",
                "algorithmId": "det.cluster.hdbscan",
                "defType": "det.clustering",
                "description": "Groups rules and transaction vectors into density-based fraud rings.",
                "params": {"min_cluster_size": 15, "metric": "euclidean"},
            },
        },
        {
            "id": "node_det_iforest",
            "type": "pipeline",
            "position": {"x": 1120, "y": 290},
            "data": {
                "label": "Isolation Forest Outlier Detection",
                "category": "detection",
                "detectionSubType": "anomaly",
                "algorithmId": "det.anomaly.isolation-forest",
                "defType": "det.anomaly",
                "description": "Isolates abnormal transaction patterns using isolation trees.",
                "params": {"n_estimators": 100, "contamination": 0.05},
            },
        },
        {
            "id": "node_det_xgboost",
            "type": "pipeline",
            "position": {"x": 1400, "y": 190},
            "data": {
                "label": "XGBoost Fraud Risk Classifier",
                "category": "detection",
                "detectionSubType": "classification",
                "algorithmId": "det.class.xgboost",
                "defType": "det.classification",
                "description": "Supervised gradient boosted decision tree classifier.",
                "params": {"max_depth": 6, "learning_rate": 0.05, "n_estimators": 200},
            },
        },
        {
            "id": "node_out_review",
            "type": "pipeline",
            "position": {"x": 1680, "y": 190},
            "data": {
                "label": "Automated Case Review & Alerting",
                "category": "output",
                "defType": "out.flag-review",
                "description": "Dispatches flagged transactions to analyst queue and webhooks.",
            },
        },
    ]

    edges = [
        {"id": "e1", "source": "node_md_rules", "target": "node_pre_cleaning"},
        {"id": "e2", "source": "node_tx_feed", "target": "node_pre_cleaning"},
        {"id": "e3", "source": "node_pre_cleaning", "target": "node_pre_missing"},
        {"id": "e4", "source": "node_pre_missing", "target": "node_feat_mi"},
        {"id": "e5", "source": "node_feat_mi", "target": "node_det_hdbscan"},
        {"id": "e6", "source": "node_feat_mi", "target": "node_det_iforest"},
        {"id": "e7", "source": "node_det_hdbscan", "target": "node_det_xgboost"},
        {"id": "e8", "source": "node_det_iforest", "target": "node_det_xgboost"},
        {"id": "e9", "source": "node_det_xgboost", "target": "node_out_review"},
    ]

    conn.execute(
        """INSERT INTO pipelines (id, name, description, nodes_json, edges_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            mega_id,
            "Enterprise Fraud & Risk Mega Pipeline",
            "Comprehensive end-to-end pipeline covering Markdown rules, transaction feeds, preprocessing, Mutual Information feature selection, HDBSCAN clustering, Isolation Forest, and XGBoost classification.",
            json.dumps(nodes),
            json.dumps(edges),
            now,
            now,
        ),
    )


def save_pipeline(
    pipeline_id: str,
    name: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    description: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    nodes_json = json.dumps(nodes)
    edges_json = json.dumps(edges)
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO pipelines (id, name, description, nodes_json, edges_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, description=excluded.description,
               nodes_json=excluded.nodes_json, edges_json=excluded.edges_json,
               updated_at=excluded.updated_at""",
            (pipeline_id, name, description or "", nodes_json, edges_json, now, now),
        )
    return get_pipeline(pipeline_id)  # type: ignore[return-value]


def list_pipelines() -> list[dict[str, Any]]:
    with _lock, get_conn() as conn:
        rows = conn.execute("SELECT * FROM pipelines ORDER BY updated_at DESC").fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            out.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "nodes": json.loads(r["nodes_json"]) if r["nodes_json"] else [],
                "edges": json.loads(r["edges_json"]) if r["edges_json"] else [],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return out


def get_pipeline(pipeline_id: str) -> dict[str, Any] | None:
    with _lock, get_conn() as conn:
        row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "nodes": json.loads(row["nodes_json"]) if row["nodes_json"] else [],
            "edges": json.loads(row["edges_json"]) if row["edges_json"] else [],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }


def delete_pipeline(pipeline_id: str) -> bool:
    with _lock, get_conn() as conn:
        cursor = conn.execute("DELETE FROM pipelines WHERE id = ?", (pipeline_id,))
        return cursor.rowcount > 0


def insert_execution(
    exec_id: str,
    pipeline_id: str,
    pipeline_name: str,
    pipeline_json: dict[str, Any],
    dataset_ref: str | None,
    started_at: str,
    created_at: str,
) -> None:
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO executions
               (id, pipeline_id, pipeline_name, pipeline_json, dataset_ref, status, started_at, created_at)
               VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)""",
            (exec_id, pipeline_id, pipeline_name, json.dumps(pipeline_json), dataset_ref, started_at, created_at),
        )


def update_execution_status(
    exec_id: str,
    status: str,
    completed_at: str | None = None,
    summary: dict[str, Any] | None = None,
) -> None:
    with _lock, get_conn() as conn:
        conn.execute(
            """UPDATE executions SET status = ?, completed_at = ?, summary_json = ? WHERE id = ?""",
            (status, completed_at, json.dumps(summary) if summary else None, exec_id),
        )


def get_execution(exec_id: str) -> dict[str, Any] | None:
    with _lock, get_conn() as conn:
        row = conn.execute("SELECT * FROM executions WHERE id = ?", (exec_id,)).fetchone()
        if not row:
            return None
        return _row_to_execution(row)


def list_executions(limit: int = 50) -> list[dict[str, Any]]:
    with _lock, get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM executions ORDER BY started_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_row_to_execution(r) for r in rows]


def _row_to_execution(row: sqlite3.Row) -> dict[str, Any]:
    out: dict[str, Any] = dict(row)
    out["pipeline_json"] = json.loads(row["pipeline_json"]) if row["pipeline_json"] else None
    out["summary"] = json.loads(row["summary_json"]) if row["summary_json"] else None
    out.pop("summary_json", None)
    return out


def count_executions() -> int:
    with _lock, get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM executions").fetchone()
        return int(row["c"]) if row else 0


def count_distinct_pipelines() -> int:
    with _lock, get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(DISTINCT pipeline_id) AS c FROM executions"
        ).fetchone()
        return int(row["c"]) if row else 0


def insert_dataset(
    ds_id: str,
    name: str,
    source: str,
    row_count: int,
    created_at: str,
    path: str | None = None,
    rows_json: str | None = None,
) -> None:
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO datasets (id, name, source, row_count, created_at, path, rows_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ds_id, name, source, row_count, created_at, path, rows_json),
        )


def get_dataset(ds_id: str) -> dict[str, Any] | None:
    with _lock, get_conn() as conn:
        row = conn.execute("SELECT * FROM datasets WHERE id = ?", (ds_id,)).fetchone()
        if not row:
            return None
        out: dict[str, Any] = dict(row)
        if row["rows_json"]:
            out["rows"] = json.loads(row["rows_json"])
        return out
