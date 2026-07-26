"""Simulated pipeline execution engine.

Walks the pipeline graph in topological order, emits per-node status
messages, and produces a results payload with flagged transactions and
summary metrics. Real computation is faked with small artificial delays
so the demo feels like something is actually happening.
"""
import asyncio
import random
import time
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from .dataset import get_sample_dataset, parse_csv


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _topo_order(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {n["id"]: n for n in nodes}
    indeg: dict[str, int] = {nid: 0 for nid in by_id}
    adj: dict[str, list[str]] = {nid: [] for nid in by_id}
    for e in edges:
        src, tgt = e.get("source"), e.get("target")
        if src in by_id and tgt in by_id:
            adj[src].append(tgt)
            indeg[tgt] += 1
    queue = [nid for nid, d in indeg.items() if d == 0]
    order_ids: list[str] = []
    while queue:
        nid = queue.pop(0)
        order_ids.append(nid)
        for nxt in adj[nid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    # Append any leftover (cycles / disconnected) so nothing is skipped.
    for nid in by_id:
        if nid not in order_ids:
            order_ids.append(nid)
    return [by_id[nid] for nid in order_ids]


def _node_label(node: dict[str, Any]) -> str:
    data = node.get("data", {})
    return str(data.get("label") or node.get("id"))


def _node_category(node: dict[str, Any]) -> str:
    return str(node.get("data", {}).get("category") or "unknown")


def _node_algorithm(node: dict[str, Any]) -> str | None:
    data = node.get("data", {})
    return data.get("algorithmId") or data.get("defType")


def _delay_for(node: dict[str, Any], rng: random.Random) -> float:
    category = _node_category(node)
    base = {"input": 0.8, "preprocessing": 1.4, "feature": 1.8, "detection": 2.6, "output": 1.0}.get(
        category, 1.5
    )
    return base + rng.uniform(0.2, 0.9)


def _score_transactions(rows: list[dict[str, Any]], node: dict[str, Any], rng: random.Random) -> list[float]:
    """Produce a deterministic-ish fraud score per row for a detection node."""
    algo = _node_algorithm(node) or ""
    n = len(rows)
    scores: list[float] = []
    for row in rows:
        amount = float(row.get("amount", 0) or 0)
        # Higher amount + fraud rows score higher; add algorithm-specific jitter.
        base = min(1.0, amount / 5000.0)
        if "isolation" in algo or "forest" in algo:
            base = 0.4 + 0.5 * base + rng.uniform(-0.05, 0.05)
        elif "lof" in algo:
            base = 0.3 + 0.5 * base + rng.uniform(-0.08, 0.08)
        elif "autoencoder" in algo:
            base = 0.35 + 0.45 * base + rng.uniform(-0.06, 0.06)
        elif "xgboost" in algo or "lightgbm" in algo:
            base = 0.25 + 0.6 * base + rng.uniform(-0.04, 0.04)
        elif "logistic" in algo:
            base = 0.2 + 0.5 * base + rng.uniform(-0.03, 0.03)
        elif "dbscan" in algo or "hdbscan" in algo:
            base = 0.3 + 0.4 * base + rng.uniform(-0.1, 0.1)
        else:
            base = 0.3 + 0.4 * base + rng.uniform(-0.05, 0.05)
        if int(row.get("is_fraud", 0)) == 1:
            base += rng.uniform(0.15, 0.35)
        scores.append(max(0.0, min(1.0, base)))
    return scores


def _threshold_for(node: dict[str, Any], scores: list[float] | None = None) -> float:
    """Derive a flagging threshold. If the node exposes a `threshold` param,
    use it directly. Otherwise, if it exposes `contamination` (expected anomaly
    fraction), return the percentile cutoff so that fraction would be flagged.
    Falls back to 0.5."""
    data = node.get("data", {})
    params = data.get("params") or {}
    if "threshold" in params:
        try:
            return float(params["threshold"])  # type: ignore[arg-type]
        except (TypeError, ValueError):
            pass
    if "contamination" in params and scores:
        try:
            cont = float(params["contamination"])  # type: ignore[arg-type]
            cont = max(0.001, min(0.5, cont))
            sorted_scores = sorted(scores)
            idx = int(len(sorted_scores) * (1.0 - cont))
            idx = max(0, min(len(sorted_scores) - 1, idx))
            return sorted_scores[idx]
        except (TypeError, ValueError):
            pass
    return 0.5


def _build_results(
    rows: list[dict[str, Any]],
    detection_scores: dict[str, list[float]],
    detection_nodes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Combine per-detection-node scores into final flagged rows + metrics."""
    n = len(rows)
    flagged_rows: list[dict[str, Any]] = []
    flagged_over_time: list[dict[str, Any]] = []
    score_buckets = {"0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}

    # Compute a single threshold from the first detection node's score distribution.
    first_scores = detection_scores[detection_nodes[0]["id"]] if detection_nodes else None
    threshold = _threshold_for(detection_nodes[0], first_scores) if detection_nodes else 0.5

    tp = fp = tn = fn = 0
    for i, row in enumerate(rows):
        best_score = 0.0
        best_node_id: str | None = None
        best_node_label = "—"
        for node in detection_nodes:
            scores = detection_scores.get(node["id"], [])
            if i < len(scores) and scores[i] > best_score:
                best_score = scores[i]
                best_node_id = node["id"]
                best_node_label = _node_label(node)
        threshold = threshold
        is_flagged = best_score >= threshold
        actual_fraud = int(row.get("is_fraud", 0)) == 1

        bucket = min(4, int(best_score * 5))
        bucket_key = list(score_buckets.keys())[bucket]
        score_buckets[bucket_key] += 1

        if is_flagged and actual_fraud:
            tp += 1
        elif is_flagged and not actual_fraud:
            fp += 1
        elif not is_flagged and actual_fraud:
            fn += 1
        else:
            tn += 1

        if is_flagged:
            flagged_rows.append(
                {
                    "transaction_id": row.get("transaction_id", f"txn_{i}"),
                    "score": round(best_score, 4),
                    "flagged": "Y",
                    "flagged_by": best_node_label,
                    "amount": row.get("amount", 0),
                    "country": row.get("country", ""),
                    "is_fraud": actual_fraud,
                }
            )
            ts = int(row.get("timestamp", 0) or 0)
            flagged_over_time.append({"t": ts, "flagged": len(flagged_rows)})

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    flagged_count = tp + fp

    return {
        "summary": {
            "total_transactions": n,
            "flagged": flagged_count,
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "false_positive_rate": round(fpr, 4),
        },
        "score_distribution": [{"bucket": k, "count": v} for k, v in score_buckets.items()],
        "flagged_over_time": flagged_over_time,
        "flagged_rows": flagged_rows,
        "detection_nodes": [
            {"id": n["id"], "label": _node_label(n), "algorithm": _node_algorithm(n)}
            for n in detection_nodes
        ],
    }


async def run_pipeline(
    pipeline: dict[str, Any],
    dataset_ref: str | None,
    dataset_rows: list[dict[str, Any]] | None,
    upload_bytes: bytes | None,
    upload_name: str | None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield status messages, ending with a 'complete' message carrying results."""
    rng = random.Random(hash(str(pipeline.get("id", "")) or 0) & 0xFFFFFFFF)
    nodes = pipeline.get("nodes", []) or []
    edges = pipeline.get("edges", []) or []
    ordered = _topo_order(nodes, edges)

    if dataset_rows is not None:
        rows = dataset_rows
    elif upload_bytes is not None:
        ds = parse_csv(upload_bytes, upload_name or "upload.csv")
        rows = ds["rows"]
    else:
        ds = get_sample_dataset()
        rows = ds["rows"]

    yield {
        "type": "log",
        "level": "info",
        "message": f"Loaded {len(rows)} transactions from dataset.",
        "node_id": None,
        "node_status": None,
        "timestamp": _now_iso(),
    }

    detection_scores: dict[str, list[float]] = {}
    detection_nodes: list[dict[str, Any]] = []
    start = time.monotonic()

    for node in ordered:
        category = _node_category(node)
        label = _node_label(node)
        algo = _node_algorithm(node)

        yield {
            "type": "node",
            "node_id": node["id"],
            "node_label": label,
            "node_status": "running",
            "category": category,
            "message": f"{category.capitalize()}: {label} — running...",
            "timestamp": _now_iso(),
        }

        delay = _delay_for(node, rng)
        await asyncio.sleep(delay)

        if category == "detection":
            scores = _score_transactions(rows, node, rng)
            detection_scores[node["id"]] = scores
            detection_nodes.append(node)
            algo_name = algo or label
            yield {
                "type": "log",
                "level": "info",
                "message": f"Detection: {label} ({algo_name}) scored {len(scores)} rows.",
                "node_id": node["id"],
                "node_status": "complete",
                "timestamp": _now_iso(),
            }
        else:
            yield {
                "type": "log",
                "level": "info",
                "message": f"{category.capitalize()}: {label} — complete",
                "node_id": node["id"],
                "node_status": "complete",
                "timestamp": _now_iso(),
            }

        yield {
            "type": "node",
            "node_id": node["id"],
            "node_label": label,
            "node_status": "complete",
            "category": category,
            "message": f"{category.capitalize()}: {label} — complete",
            "timestamp": _now_iso(),
        }

    elapsed = time.monotonic() - start
    results = _build_results(rows, detection_scores, detection_nodes)
    results["summary"]["execution_time_seconds"] = round(elapsed, 2)

    yield {
        "type": "complete",
        "message": "Pipeline execution complete.",
        "results": results,
        "timestamp": _now_iso(),
    }
