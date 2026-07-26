"""SQLite persistence for executions and uploaded datasets."""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Any

DB_PATH = os.environ.get("COHERENCEIQ_DB", os.path.join(os.path.dirname(__file__), "..", "data", "coherenceiq.db"))

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
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
            """
        )


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
