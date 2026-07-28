"""Pipeline Model & Rule Configuration Artifact Store.

Manages versioned serialization, persistence, and loading of:
1. Rule configuration ASTs (rules_v1.json, rules_v5.json).
2. Fitted ML model artifacts (scaler, PCA, HDBSCAN, IsolationForest, LightGBM/HistGradientBoosting).
"""

import json
import os
from pathlib import Path
from typing import Any
import joblib

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"


def _ensure_dir():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def get_pipeline_dir(pipeline_id: str) -> Path:
    """Get or create dedicated directory for a pipeline's artifacts."""
    _ensure_dir()
    pipe_dir = ARTIFACTS_DIR / pipeline_id
    pipe_dir.mkdir(parents=True, exist_ok=True)
    return pipe_dir


def save_rule_config(pipeline_id: str, rules_summary: list[dict[str, Any]], version: str = "v1") -> str:
    """Save rule configuration AST as versioned JSON artifact in pipeline directory."""
    pipe_dir = get_pipeline_dir(pipeline_id)
    filename = f"rules_{version}.json"
    filepath = pipe_dir / filename
    
    payload = {
        "pipeline_id": pipeline_id,
        "version": version,
        "rules_count": len(rules_summary),
        "rules": rules_summary,
    }
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        
    return str(filepath)


def load_rule_config(pipeline_id: str, version: str = "v1") -> list[dict[str, Any]]:
    """Load versioned rule configuration JSON."""
    pipe_dir = get_pipeline_dir(pipeline_id)
    filepath = pipe_dir / f"rules_{version}.json"
    if not filepath.exists():
        filepath = ARTIFACTS_DIR / f"rules_{pipeline_id}_{version}.json"
        if not filepath.exists():
            filepath = ARTIFACTS_DIR / "rules_default_v1.json"
            if not filepath.exists():
                return []
            
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("rules", [])


def save_model_artifact(pipeline_id: str, artifact_name: str, model_obj: Any) -> str:
    """Serialize a fitted scikit-learn / XGBoost model artifact (.joblib) into pipeline folder."""
    pipe_dir = get_pipeline_dir(pipeline_id)
    clean_name = artifact_name if artifact_name.endswith(".joblib") else f"{artifact_name}.joblib"
    filepath = pipe_dir / clean_name
    joblib.dump(model_obj, filepath)
    return str(filepath)


def load_model_artifact(pipeline_id: str, artifact_name: str) -> Any | None:
    """Load a serialized pipeline model artifact (.joblib)."""
    pipe_dir = get_pipeline_dir(pipeline_id)
    clean_name = artifact_name if artifact_name.endswith(".joblib") else f"{artifact_name}.joblib"
    filepath = pipe_dir / clean_name
    if not filepath.exists():
        # Fallback to root level
        filepath = ARTIFACTS_DIR / f"{pipeline_id}_{clean_name}"
        if not filepath.exists():
            return None
    try:
        return joblib.load(filepath)
    except Exception:
        return None


def list_pipeline_artifacts(pipeline_id: str) -> list[dict[str, Any]]:
    """List all saved artifacts for a given pipeline from both root and pipeline directory."""
    _ensure_dir()
    artifacts = []
    
    # 1. Pipeline-specific directory: artifacts/pipeline_id/
    pipe_dir = ARTIFACTS_DIR / pipeline_id
    if pipe_dir.exists() and pipe_dir.is_dir():
        for p in pipe_dir.glob("*"):
            if p.is_file():
                artifacts.append({
                    "name": p.name,
                    "path": str(p),
                    "size_bytes": p.stat().st_size,
                    "modified": p.stat().st_mtime,
                    "pipeline_id": pipeline_id,
                })

    # 2. Root directory artifacts matching pipeline_id
    for p in ARTIFACTS_DIR.glob(f"*{pipeline_id}*"):
        if p.is_file():
            # avoid duplicates if already added
            if not any(a["path"] == str(p) for a in artifacts):
                artifacts.append({
                    "name": p.name,
                    "path": str(p),
                    "size_bytes": p.stat().st_size,
                    "modified": p.stat().st_mtime,
                    "pipeline_id": pipeline_id,
                })
                
    return artifacts
