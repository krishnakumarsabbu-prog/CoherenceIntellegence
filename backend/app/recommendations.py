"""Rule-based recommendation engine for completed pipeline runs.

This is a heuristic lookup, NOT a machine-learning model. It inspects the
pipeline's structure (nodes + edges) and the resulting summary metrics, then
returns any suggestions whose trigger conditions match. Rules live in a single
JSON-ish lookup table (RULES) so they can be extended without touching UI code.
"""
from __future__ import annotations

import json
from typing import Any

# Each rule has:
#   id            stable identifier surfaced to the UI
#   title         short headline
#   why           one-sentence rationale
#   estimate      static "Preview Impact" delta (clearly an estimate, not a guarantee)
#   match(pipeline, summary) -> bool   predicate over pipeline graph + summary metrics
#
# Predicates receive:
#   pipeline  = {id, name, nodes:[{id,data:{category,defType,algorithmId,params,...}}], edges:[...]}
#   summary   = {precision, recall, f1, false_positive_rate, flagged, ...}


def _upstream_node_ids(node_id: str, nodes: list[dict], edges: list[dict]) -> set[str]:
    """Return ids of all nodes that transitively feed into `node_id`."""
    by_target = {e["target"] for e in edges if e.get("target") == node_id}
    seen: set[str] = set()
    stack = list(by_target)
    while stack:
        nid = stack.pop()
        if nid in seen:
            continue
        seen.add(nid)
        for e in edges:
            if e.get("target") == nid and e.get("source") not in seen:
                stack.append(e["source"])
    return seen


def _has_feature_engineering_upstream(node_id: str, nodes: list[dict], edges: list[dict]) -> bool:
    for up_id in _upstream_node_ids(node_id, nodes, edges):
        n = next((x for x in nodes if x["id"] == up_id), None)
        if n and n.get("data", {}).get("category") == "feature":
            return True
    return False


def _has_class_imbalance_handling_upstream(node_id: str, nodes: list[dict], edges: list[dict]) -> bool:
    """A preprocessing node that addresses imbalance, or a classifier param
    tuned for imbalance (classWeight/scalePosWeight)."""
    for up_id in _upstream_node_ids(node_id, nodes, edges):
        n = next((x for x in nodes if x["id"] == up_id), None)
        if not n:
            continue
        if n.get("data", {}).get("category") == "preprocessing":
            label = (n.get("data", {}).get("label") or "").lower()
            if "imbalance" in label or "oversamp" in label or "smote" in label:
                return True
    return False


def _detection_nodes(nodes: list[dict]) -> list[dict]:
    return [n for n in nodes if n.get("data", {}).get("category") == "detection"]


def _algo_id(node: dict) -> str:
    d = node.get("data", {})
    return str(d.get("algorithmId") or d.get("defType") or "")


def _has_geo_or_velocity_features(pipeline: dict, summary: dict) -> bool:
    """Heuristic: the pipeline includes a velocity/aggregation feature node,
    or the dataset is the sample (which carries country + timestamp fields)."""
    nodes = pipeline.get("nodes", [])
    for n in nodes:
        d = n.get("data", {})
        if d.get("category") == "feature":
            ft = str(d.get("defType") or "")
            if "velocity" in ft or "aggregation" in ft:
                return True
    return False


RULES: list[dict[str, Any]] = [
    {
        "id": "swap-logistic-for-boosting",
        "title": "Try XGBoost or LightGBM for better handling of imbalanced fraud data",
        "why": "Logistic Regression is a linear baseline that underfits nonlinear fraud patterns; gradient-boosted trees handle the imbalanced positive class far better.",
        "estimate": {"metric": "f1", "delta": "+0.08 to +0.15", "note": "Typical uplift on imbalanced tabular fraud benchmarks; your data will vary."},
        "match": lambda p, s: any(
            "logistic" in _algo_id(n) and s.get("f1", 1.0) < 0.7
            and not _has_class_imbalance_handling_upstream(n["id"], p.get("nodes", []), p.get("edges", []))
            for n in _detection_nodes(p.get("nodes", []))
        ),
    },
    {
        "id": "swap-kmeans-for-density",
        "title": "Try DBSCAN or HDBSCAN — better suited to irregular fraud ring shapes than KMeans' spherical clusters",
        "why": "KMeans assumes spherical, equal-sized clusters; fraud rings are irregular and variable-density, which density-based clusterers capture natively.",
        "estimate": {"metric": "recall", "delta": "+0.05 to +0.12", "note": "Estimated ring recall gain; depends on eps/min_samples tuning."},
        "match": lambda p, s: any(
            "kmeans" in _algo_id(n) and _has_geo_or_velocity_features(p, s)
            for n in _detection_nodes(p.get("nodes", []))
        ),
    },
    {
        "id": "add-feature-engineering",
        "title": "Add a Feature Engineering step — raw transaction fields rarely perform as well as engineered velocity/aggregation features",
        "why": "Detection nodes scoring raw fields miss burst and baseline signals (txn count last 5 min, spend vs 30-day mean) that separate fraud from normal.",
        "estimate": {"metric": "f1", "delta": "+0.04 to +0.10", "note": "Common lift when adding velocity + aggregation features upstream of a detector."},
        "match": lambda p, s: any(
            not _has_feature_engineering_upstream(n["id"], p.get("nodes", []), p.get("edges", []))
            for n in _detection_nodes(p.get("nodes", []))
        ),
    },
    {
        "id": "high-fpr-isolation-lof",
        "title": "Consider Isolation Forest or LOF, tuned to a stricter contamination threshold",
        "why": "A false positive rate above 15% means analysts are drowning in false alarms; anomaly detectors with a lower contamination cutoff flag fewer non-fraud rows.",
        "estimate": {"metric": "false_positive_rate", "delta": "-40% to -60% (relative)", "note": "Reduces FPR at the cost of some recall; re-tune to your tolerance."},
        "match": lambda p, s: float(s.get("false_positive_rate", 0.0)) > 0.15,
    },
]


def build_recommendations(pipeline: dict[str, Any], summary: dict[str, Any]) -> list[dict[str, Any]]:
    """Evaluate all rules and return the triggered suggestions."""
    hits: list[dict[str, Any]] = []
    for rule in RULES:
        try:
            if rule["match"](pipeline, summary):
                hits.append({
                    "id": rule["id"],
                    "title": rule["title"],
                    "why": rule["why"],
                    "estimate": rule["estimate"],
                })
        except Exception:  # noqa: BLE001 - a single bad rule must not break the run
            continue
    return hits


def recommendations_json(pipeline: dict[str, Any], summary: dict[str, Any]) -> str:
    return json.dumps(build_recommendations(pipeline, summary))
