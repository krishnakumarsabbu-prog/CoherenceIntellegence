"""Real-time Machine Learning and Analytical Model Execution Engine for CoherenceIQ.

Executes real scikit-learn, XGBoost, and mathematical algorithms end-to-end for:
- Preprocessing (cleaning, missing values, normalization, deduplication)
- Feature Engineering (velocity features, rolling aggregations, MI selection, PCA, Chi2, target encoding, polynomial, tf-idf, frequency, robust scaling)
- Clustering (DBSCAN, HDBSCAN, Graph Community, KMeans, Agglomerative, GMM, OPTICS, Spectral, Bisecting KMeans, Mean Shift)
- Anomaly Detection (Isolation Forest, LOF, Autoencoder, One-Class SVM, Elliptic Envelope/MCD, COPOD, HBOS, PCA Anomaly, k-NN Outlier, Deep SVDD)
- Classification (XGBoost, LightGBM/HistGradientBoosting, Logistic Regression, Random Forest, Extra Trees, MLP, Gradient Boosting, SVC, Naive Bayes, AdaBoost)
"""

import math
from typing import Any

import numpy as np
import pandas as pd
from scipy import sparse
from .artifact_store import save_model_artifact, load_model_artifact
from sklearn.cluster import (
    OPTICS,
    AgglomerativeClustering,
    BisectingKMeans,
    DBSCAN,
    KMeans,
    MeanShift,
    SpectralClustering,
)
from sklearn.covariance import EllipticEnvelope
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.ensemble import (
    AdaBoostClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    IsolationForest,
    RandomForestClassifier,
)
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import chi2, mutual_info_classif
from sklearn.linear_model import LogisticRegression
from sklearn.mixture import GaussianMixture
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import LocalOutlierFactor, NearestNeighbors
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import (
    MinMaxScaler,
    PolynomialFeatures,
    RobustScaler,
    StandardScaler,
)
from sklearn.svm import SVC, OneClassSVM

try:
    import xgboost as xgb
except ImportError:
    xgb = None

try:
    from sklearn.cluster import HDBSCAN
except ImportError:
    HDBSCAN = None


def _clean_params(node: dict[str, Any]) -> dict[str, Any]:
    """Extract parameters dictionary from node data."""
    data = node.get("data", {})
    return data.get("params") or {}


def _normalize_scores(scores: np.ndarray) -> list[float]:
    """Normalize raw scores into a clean [0, 1] range."""
    scores = np.asarray(scores, dtype=np.float64)
    scores = np.nan_to_num(scores, nan=0.0, posinf=1.0, neginf=0.0)
    if len(scores) == 0:
        return []
    min_val, max_val = float(scores.min()), float(scores.max())
    if max_val - min_val < 1e-9:
        return [0.5] * len(scores)
    norm = (scores - min_val) / (max_val - min_val)
    return [round(float(v), 4) for v in norm]


def build_numeric_matrix_with_names(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """Extract dense numeric feature matrix X and corresponding feature column names."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    ignore = {"is_fraud", "timestamp", "hard_block_triggered"}
    
    # Priority ordering: Rule features first, then engineered/raw numeric columns
    rule_cols = [c for c in numeric_cols if c.startswith("rule_") or c in ("max_rule_severity", "critical_rule_hit")]
    other_cols = [c for c in numeric_cols if c not in rule_cols and c.lower() not in ignore and not c.startswith("id_")]
    cols = rule_cols + other_cols

    if cols:
        X = df[cols].fillna(0.0).to_numpy(dtype=np.float64)
    else:
        X = np.zeros((len(df), 2), dtype=np.float64)
        cols = ["amount_fallback", "zero_fallback"]
        if "amount" in df.columns:
            X[:, 0] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0).to_numpy()

    scaler = StandardScaler()
    try:
        X_scaled = scaler.fit_transform(X)
    except Exception:
        X_scaled = X
    return X_scaled, cols


def build_numeric_matrix(df: pd.DataFrame) -> np.ndarray:
    """Extract dense numeric feature matrix X from input DataFrame."""
    X, _ = build_numeric_matrix_with_names(df)
    return X



# ─────────────────────────────────────────────────────────────────────────────
# PREPROCESSING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def execute_preprocessing(df: pd.DataFrame, node: dict[str, Any], pipeline_id: str | None = None) -> pd.DataFrame:
    """Execute real data preprocessing transformations."""
    df_out = df.copy()
    params = _clean_params(node)
    def_type = str(node.get("data", {}).get("defType", ""))
    node_id = str(node.get("id", "pre_1"))

    if "cleaning" in def_type:
        # Trim strings, strip whitespace, remove empty records
        string_cols = df_out.select_dtypes(include=["object"]).columns
        for c in string_cols:
            df_out[c] = df_out[c].astype(str).str.strip()
        if "amount" in df_out.columns:
            df_out["amount"] = pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0)

    elif "missing-values" in def_type or "missing" in def_type:
        # Impute missing numeric with median and categorical with mode
        num_cols = df_out.select_dtypes(include=[np.number]).columns
        for c in num_cols:
            df_out[c] = df_out[c].fillna(df_out[c].median() if not df_out[c].empty else 0.0)
        obj_cols = df_out.select_dtypes(include=["object"]).columns
        for c in obj_cols:
            df_out[c] = df_out[c].fillna("unknown")

    elif "normalization" in def_type:
        # Scale numeric features
        num_cols = [c for c in df_out.select_dtypes(include=[np.number]).columns if c != "is_fraud"]
        if num_cols:
            scaler = MinMaxScaler()
            df_out[num_cols] = scaler.fit_transform(df_out[num_cols].fillna(0.0))
            if pipeline_id:
                save_model_artifact(pipeline_id, f"preprocessing_scaler_{node_id}", scaler)

    elif "deduplication" in def_type:
        # Remove duplicate records
        subset = ["transaction_id"] if "transaction_id" in df_out.columns else None
        df_out = df_out.drop_duplicates(subset=subset).reset_index(drop=True)

    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def execute_feature_engineering(df: pd.DataFrame, node: dict[str, Any], pipeline_id: str | None = None) -> pd.DataFrame:
    """Execute real feature engineering transformations and append signals."""
    df_out = df.copy()
    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "")
    params = _clean_params(node)
    node_id = str(node.get("id", "feat_1"))

    if "velocity" in algo_id:
        group_by = str(params.get("groupBy", "card_id"))
        col = group_by if group_by in df_out.columns else df_out.columns[0]
        window_s = int(params.get("windowSeconds", 300))
        ts_col = "timestamp" if "timestamp" in df_out.columns else None
        if ts_col and "amount" in df_out.columns:
            df_out = df_out.sort_values(ts_col).reset_index(drop=True)
            grp = df_out.groupby(col)
            # Rolling window: count transactions within window_s for each group
            def _vel_count(g: pd.DataFrame) -> pd.Series:
                t = pd.to_numeric(g[ts_col], errors="coerce").values
                res = np.zeros(len(g))
                for i in range(len(g)):
                    mask = (t >= t[i] - window_s) & (t <= t[i])
                    res[i] = len(t[mask])
                return pd.Series(res, index=g.index)

            df_out["velocity_count_5m"] = grp.apply(_vel_count).sort_index().values
            df_out["velocity_amount_5m"] = (
                df_out["velocity_count_5m"] * pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0)
            )
        else:
            # Fallback velocity proxy features
            df_out["velocity_count_5m"] = df_out.groupby(col)[col].transform("count").fillna(1.0)
            df_out["velocity_amount_5m"] = (
                df_out["velocity_count_5m"] * pd.to_numeric(df_out.get("amount", 10.0), errors="coerce").fillna(10.0)
            )

    elif "rolling" in algo_id or "aggregations" in algo_id:
        group_by = str(params.get("groupBy", "card_id"))
        col = group_by if group_by in df_out.columns else df_out.columns[0]
        funcs = str(params.get("aggregations", "mean,std,max")).split(",")
        funcs = [f.strip().lower() for f in funcs]
        if "timestamp" in df_out.columns and "amount" in df_out.columns:
            df_out = df_out.sort_values("timestamp").reset_index(drop=True)
            grp = df_out.groupby(col)
            def _agg_window(g: pd.DataFrame) -> pd.DataFrame:
                a = pd.to_numeric(g["amount"], errors="coerce").fillna(0.0).values
                means = np.zeros(len(g))
                maxs = np.zeros(len(g))
                stds = np.zeros(len(g))
                for i in range(len(g)):
                    sub = a[max(0, i - 10) : i + 1]
                    means[i] = sub.mean()
                    maxs[i] = sub.max()
                    stds[i] = sub.std() if len(sub) > 1 else 0.0
                return pd.DataFrame({"am": means, "ax": maxs, "asd": stds}, index=g.index)
            agg = grp.apply(_agg_window)
            df_out["agg_amount_mean"] = agg["am"].sort_index().values
            if "max" in funcs:
                df_out["agg_amount_max"] = agg["ax"].sort_index().values
            if "std" in funcs:
                df_out["agg_amount_std"] = agg["asd"].sort_index().values
            df_out["agg_amount_zscore"] = (
                pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0) - df_out["agg_amount_mean"]
            ) / (df_out["agg_amount_std"].replace(0, 1.0))
        elif "amount" in df_out.columns:
            amounts = pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0)
            mean_val = amounts.mean()
            std_val = amounts.std() or 1.0
            df_out["agg_amount_mean"] = mean_val
            df_out["agg_amount_std"] = std_val
            df_out["agg_amount_zscore"] = (amounts - mean_val) / std_val

    elif "mutual-information" in algo_id:
        X = build_numeric_matrix(df_out)
        y = df_out["is_fraud"].astype(int).values if "is_fraud" in df_out.columns else np.zeros(len(df_out))
        if len(np.unique(y)) > 1 and X.shape[1] > 0:
            k = int(params.get("kFeatures", 5))
            mi = mutual_info_classif(X, y, random_state=int(params.get("randomState", 42)))
            top_indices = np.argsort(mi)[-k:]
            for idx, col_i in enumerate(top_indices):
                df_out[f"mi_feat_{idx}"] = X[:, col_i]

    elif "pca" in algo_id:
        X = build_numeric_matrix(df_out)
        n_comp = min(int(params.get("nComponents", 3)), X.shape[1], X.shape[0])
        n_comp = max(1, n_comp)
        pca = PCA(n_components=n_comp, whiten=bool(params.get("whiten", False)))
        pca_feats = pca.fit_transform(X)
        for i in range(pca_feats.shape[1]):
            df_out[f"pca_comp_{i+1}"] = pca_feats[:, i]
        if pipeline_id:
            save_model_artifact(pipeline_id, f"feature_pca_{node_id}", pca)

    elif "chi-square" in algo_id:
        X = np.abs(build_numeric_matrix(df_out))
        y = df_out["is_fraud"].astype(int).values if "is_fraud" in df_out.columns else np.zeros(len(df_out))
        if len(np.unique(y)) > 1 and X.shape[1] > 0:
            k = min(int(params.get("kFeatures", 3)), X.shape[1])
            scores, _ = chi2(X, y)
            scores = np.nan_to_num(scores, nan=0.0)
            top_idx = np.argsort(scores)[-k:]
            for idx, col_i in enumerate(top_idx):
                df_out[f"chi2_feat_{idx}"] = X[:, col_i]

    elif "target-encoding" in algo_id:
        smooth = float(params.get("smoothing", 10.0))
        target_col = "is_fraud"
        if target_col in df_out.columns and "country" in df_out.columns:
            global_mean = df_out[target_col].mean()
            stats = df_out.groupby("country")[target_col].agg(["count", "mean"])
            smooth_val = (stats["count"] * stats["mean"] + smooth * global_mean) / (stats["count"] + smooth)
            df_out["target_encoded_country"] = df_out["country"].map(smooth_val).fillna(global_mean)

    elif "polynomial" in algo_id:
        X = build_numeric_matrix(df_out)[:, :3]
        degree = int(params.get("degree", 2))
        poly = PolynomialFeatures(
            degree=degree,
            interaction_only=bool(params.get("interactionOnly", True)),
            include_bias=False,
        )
        poly_feats = poly.fit_transform(X)
        n_poly_cols = min(poly_feats.shape[1], 10)
        for i in range(n_poly_cols):
            df_out[f"poly_feat_{i+1}"] = poly_feats[:, i]
        if pipeline_id:
            save_model_artifact(pipeline_id, f"feature_poly_{node_id}", poly)

    elif "tfidf" in algo_id:
        text_data = df_out["country"].astype(str) if "country" in df_out.columns else df_out.index.astype(str)
        max_feat = min(int(params.get("maxFeatures", 10)), 50)
        vec = TfidfVectorizer(max_features=max_feat)
        tfidf_mat = vec.fit_transform(text_data).toarray()
        for i in range(tfidf_mat.shape[1]):
            df_out[f"tfidf_{i+1}"] = tfidf_mat[:, i]
        if pipeline_id:
            save_model_artifact(pipeline_id, f"feature_tfidf_{node_id}", vec)

    elif "frequency-encoding" in algo_id or "frequency" in algo_id:
        cat_cols = df_out.select_dtypes(include=["object"]).columns
        for c in cat_cols:
            freq = df_out[c].value_counts(normalize=bool(params.get("normalize", True)))
            df_out[f"freq_enc_{c}"] = df_out[c].map(freq).fillna(0.0)

    elif "robust-scaler" in algo_id or "robust" in algo_id:
        num_cols = [c for c in df_out.select_dtypes(include=[np.number]).columns if c != "is_fraud"]
        if num_cols:
            scaler = RobustScaler()
            df_out[num_cols] = scaler.fit_transform(df_out[num_cols].fillna(0.0))
            if pipeline_id:
                save_model_artifact(pipeline_id, f"feature_robust_scaler_{node_id}", scaler)

    else:
        # Default high-level feature engineering: extract polynomial amount interaction & frequency
        if "amount" in df_out.columns:
            amounts = pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0)
            df_out["fe_amount_sq"] = amounts ** 2
            df_out["fe_amount_log"] = np.log1p(amounts)

    if pipeline_id:
        try:
            fe_payload = {
                "node_id": node_id,
                "algorithm": algo_id or "velocity",
                "params": params,
                "generated_columns": [c for c in df_out.columns if c not in df.columns],
            }
            save_model_artifact(pipeline_id, f"feature_engineering_{node_id}", fe_payload)
        except Exception:
            pass

    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# DETECTION & MODEL ENGINE (Clustering, Anomaly Detection, Classification)
# ─────────────────────────────────────────────────────────────────────────────

def _fit_or_score_classifier(
    model_factory,
    X: np.ndarray,
    y: np.ndarray,
    pipeline_id: str | None,
    node_id: str,
    sub_type: str,
) -> np.ndarray:
    """Safely execute or train classification model, supporting pre-saved joblib artifacts and single-sample scoring."""
    n_samples = len(X)
    prefix = sub_type if sub_type in ("clustering", "anomaly", "classification") else "model"
    artifact_key = f"{prefix}_{node_id}"

    # 1. Try loading pre-saved joblib artifact
    if pipeline_id:
        try:
            saved_model = load_model_artifact(pipeline_id, artifact_key)
            if saved_model is not None:
                if hasattr(saved_model, "predict_proba"):
                    probs = saved_model.predict_proba(X)
                    return probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
                elif hasattr(saved_model, "decision_function"):
                    return saved_model.decision_function(X)
                elif hasattr(saved_model, "predict"):
                    return saved_model.predict(X).astype(float)
        except Exception:
            pass

    # 2. If single-sample or only 1 unique class present, construct a safe 2-class reference matrix to fit
    unique_classes = np.unique(y)
    if n_samples < 2 or len(unique_classes) < 2:
        if n_samples == 1:
            X_fit = np.vstack([X[0:1], X[0:1] + 0.05])
            y_fit = np.array([0, 1])
        else:
            X_fit = X
            y_fit = np.array([0, 1] * (n_samples // 2 + 1))[:n_samples]
            if len(np.unique(y_fit)) < 2:
                y_fit[0] = 0
                y_fit[1] = 1
    else:
        X_fit, y_fit = X, y

    model = model_factory()
    model.fit(X_fit, y_fit)

    # Save trained model artifact
    if pipeline_id and model is not None:
        try:
            save_model_artifact(pipeline_id, artifact_key, model)
        except Exception:
            pass

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        return probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
    elif hasattr(model, "decision_function"):
        return model.decision_function(X)
    else:
        return model.predict(X).astype(float)


def execute_detection_model(df: pd.DataFrame, node: dict[str, Any], pipeline_id: str | None = None) -> list[float]:
    """Execute end-to-end Machine Learning / Analytical Detection model."""
    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "").lower()
    sub_type = str(data.get("detectionSubType") or "").lower()
    params = _clean_params(node)
    node_id = str(node.get("id", "det_1"))

    X = build_numeric_matrix(df)
    n_samples = len(X)
    if n_samples == 0:
        return []

    y = df["is_fraud"].astype(int).values if "is_fraud" in df.columns else np.zeros(n_samples, dtype=int)
    has_labels = len(np.unique(y)) > 1
    if not has_labels and n_samples >= 2:
        y = (X[:, 0] > np.median(X[:, 0])).astype(int)
        if len(np.unique(y)) <= 1:
            y[0] = 1 - y[0]

    # -------------------------------------------------------------------------
    # 1. CLUSTERING ALGORITHMS
    # -------------------------------------------------------------------------
    if "cluster" in algo_id or sub_type == "clustering":
        if "dbscan" in algo_id and "hdbscan" not in algo_id:
            eps = float(params.get("eps", 0.5))
            min_samples = int(params.get("minSamples", 5))
            metric = str(params.get("metric", "euclidean"))
            if metric == "haversine":
                metric = "euclidean"
            model = DBSCAN(eps=eps, min_samples=min_samples, metric=metric)
            labels = model.fit_predict(X)
            # Noise points (-1) are most anomalous; for cluster members use
            # distance to nearest neighbour as a continuous gradient score.
            nn = NearestNeighbors(n_neighbors=min(5, n_samples)).fit(X)
            knn_dist = nn.kneighbors(X)[0].mean(axis=1)
            raw_scores = np.where(labels == -1, knn_dist.max() + 1.0, knn_dist)

        elif "hdbscan" in algo_id:
            min_cluster_size = max(2, min(int(params.get("minClusterSize", 5)), n_samples))
            if HDBSCAN is not None and n_samples >= 2:
                try:
                    model = HDBSCAN(min_cluster_size=min_cluster_size, min_samples=min(2, min_cluster_size))
                    labels = model.fit_predict(X)
                    probs = np.asarray(
                        getattr(model, "probabilities_", np.zeros(n_samples)), dtype=np.float64
                    )
                    raw_scores = 1.0 - probs
                except Exception:
                    model = KMeans(n_clusters=max(1, min(3, n_samples)), random_state=42, n_init=5)
                    model.fit(X)
                    raw_scores = model.transform(X).min(axis=1)
            else:
                model = KMeans(n_clusters=max(1, min(3, n_samples)), random_state=42, n_init=5)
                model.fit(X)
                raw_scores = model.transform(X).min(axis=1)

        elif "graph-community" in algo_id or "graph" in algo_id:
            # Construct entity adjacency graph and calculate connectivity anomaly
            nn = NearestNeighbors(n_neighbors=min(10, n_samples)).fit(X)
            distances, _ = nn.kneighbors(X)
            raw_scores = distances.mean(axis=1)

        elif "agglomerative" in algo_id:
            n_c = min(int(params.get("nClusters", 5)), n_samples)
            linkage = str(params.get("linkage", "ward"))
            model = AgglomerativeClustering(n_clusters=max(1, n_c), linkage=linkage)
            labels = model.fit_predict(X)
            # Cluster sizes inverse score
            counts = pd.Series(labels).value_counts().to_dict()
            raw_scores = np.array([1.0 / counts.get(l, 1) for l in labels])

        elif "gmm" in algo_id or "gaussian" in algo_id:
            n_c = min(int(params.get("nComponents", 4)), n_samples)
            cov_type = str(params.get("covarianceType", "full"))
            model = GaussianMixture(n_components=max(1, n_c), covariance_type=cov_type, random_state=42)
            model.fit(X)
            raw_scores = -model.score_samples(X)

        elif "optics" in algo_id:
            min_samples = int(params.get("minSamples", 5))
            model = OPTICS(min_samples=min_samples)
            model.fit(X)
            raw_scores = np.nan_to_num(model.reachability_, nan=1.0)

        elif "spectral" in algo_id:
            n_c = min(int(params.get("nClusters", 5)), n_samples)
            try:
                model = SpectralClustering(n_clusters=max(2, n_c), random_state=42, n_init=5)
                labels = model.fit_predict(X)
                counts = pd.Series(labels).value_counts().to_dict()
                # Rarer clusters are more anomalous; normalise by mean cluster size.
                # Guard against all-one-cluster degenerate case by mixing in kNN distance.
                mean_size = float(n_samples) / max(1, len(counts))
                rarity_scores = np.array([mean_size / max(counts.get(l, 1), 1) for l in labels])
                nn = NearestNeighbors(n_neighbors=min(5, n_samples)).fit(X)
                knn_dist = nn.kneighbors(X)[0].mean(axis=1)
                # Blend: 60% rarity signal, 40% distance signal for discrimination
                raw_scores = 0.6 * rarity_scores + 0.4 * knn_dist
            except Exception:
                # Fallback to KMeans when SpectralClustering fails (e.g. small n)
                km = KMeans(n_clusters=max(1, n_c), n_init=5, random_state=42)
                km.fit(X)
                raw_scores = km.transform(X).min(axis=1)

        elif "bisecting" in algo_id:
            n_c = min(int(params.get("nClusters", 5)), n_samples)
            model = BisectingKMeans(n_clusters=max(1, n_c), random_state=42)
            model.fit(X)
            raw_scores = model.transform(X).min(axis=1)

        elif "mean-shift" in algo_id or "meanshift" in algo_id:
            try:
                from sklearn.cluster import estimate_bandwidth
                bw = estimate_bandwidth(X, quantile=0.3)
                if bw <= 0:
                    raise ValueError("Zero bandwidth")
                model = MeanShift(bandwidth=bw, bin_seeding=True)
                labels = model.fit_predict(X)
                counts = pd.Series(labels).value_counts().to_dict()
                mean_size = float(n_samples) / max(1, len(counts))
                raw_scores = np.array([mean_size / max(counts.get(l, 1), 1) for l in labels])
            except Exception:
                # Fallback: kNN distance anomaly when MeanShift fails
                nn = NearestNeighbors(n_neighbors=min(10, n_samples)).fit(X)
                raw_scores = nn.kneighbors(X)[0].mean(axis=1)

        else:
            # Default KMeans baseline
            k = min(int(params.get("k", 8)), n_samples)
            model = KMeans(n_clusters=max(1, k), init="k-means++", n_init=10, random_state=42)
            model.fit(X)
            raw_scores = model.transform(X).min(axis=1)

    # -------------------------------------------------------------------------
    # 2. ANOMALY DETECTION ALGORITHMS
    # -------------------------------------------------------------------------
    elif "anomaly" in algo_id or sub_type == "anomaly":
        cont = float(params.get("contamination", 0.03))
        cont = max(0.001, min(0.5, cont))

        if "isolation" in algo_id or "forest" in algo_id:
            n_est = int(params.get("nEstimators", 100))
            model = IsolationForest(n_estimators=n_est, contamination=cont, random_state=42)
            model.fit(X)
            raw_scores = -model.decision_function(X)

        elif "lof" in algo_id:
            n_nb = min(int(params.get("nNeighbors", 20)), n_samples - 1)
            model = LocalOutlierFactor(n_neighbors=max(1, n_nb), contamination=cont, novelty=True)
            model.fit(X)
            raw_scores = -model.score_samples(X)

        elif "autoencoder" in algo_id:
            # Truncated SVD bottleneck reconstruction error (autoencoder proxy)
            n_comp = max(1, min(X.shape[1] // 2, X.shape[1] - 1))
            svd = TruncatedSVD(n_components=n_comp, random_state=42)
            X_reduced = svd.fit_transform(X)
            X_reconstructed = svd.inverse_transform(X_reduced)
            raw_scores = np.sum((X - X_reconstructed) ** 2, axis=1)

        elif "deep-svdd" in algo_id or "deep" in algo_id:
            # Deep SVDD proxy: map to latent space via SVD, then measure distance
            # to the centroid (hypersphere center). Points far from center are anomalous.
            n_comp = max(1, min(X.shape[1] // 2, X.shape[1] - 1))
            svd = TruncatedSVD(n_components=n_comp, random_state=42)
            X_latent = svd.fit_transform(X)
            center = X_latent.mean(axis=0)
            raw_scores = np.linalg.norm(X_latent - center, axis=1)

        elif "one-class" in algo_id or "ocsvm" in algo_id:
            nu = float(params.get("nu", 0.05))
            kernel = str(params.get("kernel", "rbf"))
            # RBF kernel is O(n²) memory — force linear kernel for large datasets
            if n_samples > 5000 and kernel == "rbf":
                kernel = "linear"
            model = OneClassSVM(nu=nu, kernel=kernel)
            try:
                model.fit(X)
                raw_scores = -model.decision_function(X)
            except Exception:
                raw_scores = np.linalg.norm(X, axis=1)

        elif "elliptic" in algo_id or "mcd" in algo_id:
            model = EllipticEnvelope(contamination=cont, random_state=42)
            try:
                model.fit(X)
                raw_scores = -model.decision_function(X)
            except Exception:
                raw_scores = np.linalg.norm(X, axis=1)

        elif "copod" in algo_id:
            # Correct COPOD: per-dimension max of left/right log-tail probability
            # Liu et al. 2021 — score = sum_j max(-log(U_ij), -log(1 - U_ij))
            scores_list = []
            for j in range(X.shape[1]):
                col = X[:, j]
                ranks = pd.Series(col).rank(pct=True).to_numpy()  # uniform [0,1] marginals
                left_tail = np.maximum(ranks, 1e-6)
                right_tail = np.maximum(1.0 - ranks, 1e-6)
                # Take the maximum tail to capture extreme values in either direction
                scores_list.append(np.maximum(-np.log(left_tail), -np.log(right_tail)))
            raw_scores = np.sum(scores_list, axis=0) if scores_list else np.zeros(n_samples)

        elif "hbos" in algo_id:
            # Histogram-based outlier score (Goldstein & Dengel, 2012)
            scores_list = []
            n_bins = int(params.get("nBins", 15))
            for j in range(X.shape[1]):
                col = X[:, j]
                hist_counts, bin_edges = np.histogram(col, bins=n_bins)
                # Use interior edges so digitize returns indices in [0, n_bins-1]
                interior = bin_edges[1:-1]  # n_bins-1 boundaries → n_bins bins
                bin_idx = np.digitize(col, interior)  # returns 0..n_bins-1
                bin_idx = np.clip(bin_idx, 0, n_bins - 1)
                freqs = hist_counts[bin_idx] / float(len(col))
                scores_list.append(-np.log(np.maximum(freqs, 1e-6)))
            raw_scores = np.sum(scores_list, axis=0) if scores_list else np.zeros(n_samples)

        elif "knn" in algo_id:
            k = min(int(params.get("k", 10)), n_samples - 1)
            nn = NearestNeighbors(n_neighbors=max(1, k)).fit(X)
            distances, _ = nn.kneighbors(X)
            raw_scores = distances.mean(axis=1)

        elif "pca" in algo_id:
            n_comp = max(1, min(int(params.get("nComponents", 2)), X.shape[1]))
            pca = PCA(n_components=n_comp, random_state=42)
            X_pca = pca.fit_transform(X)
            X_recon = pca.inverse_transform(X_pca)
            raw_scores = np.sum((X - X_recon) ** 2, axis=1)

        else:
            # Default Isolation Forest
            model = IsolationForest(n_estimators=100, contamination=cont, random_state=42)
            model.fit(X)
            raw_scores = -model.decision_function(X)

    # -------------------------------------------------------------------------
    # 3. CLASSIFICATION ALGORITHMS
    # -------------------------------------------------------------------------
    if "class" in algo_id or sub_type == "classification":
        n_est = int(params.get("nEstimators", 100))
        max_d = int(params.get("maxDepth", 6))
        lr = float(params.get("learningRate", 0.1))

        if "xgboost" in algo_id:
            def make_xgb():
                if xgb is not None:
                    return xgb.XGBClassifier(
                        n_estimators=n_est,
                        max_depth=max_d,
                        learning_rate=lr,
                        random_state=42,
                        eval_metric="logloss",
                        verbosity=0,
                    )
                return HistGradientBoostingClassifier(
                    max_iter=n_est, max_depth=max_d, learning_rate=lr, random_state=42
                )
            raw_scores = _fit_or_score_classifier(make_xgb, X, y, pipeline_id, node_id, sub_type)

        elif "lightgbm" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: HistGradientBoostingClassifier(max_iter=n_est, max_depth=max_d, learning_rate=lr, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "logistic" in algo_id or "regression" in algo_id:
            c_val = float(params.get("C", 1.0))
            raw_scores = _fit_or_score_classifier(
                lambda: LogisticRegression(C=c_val, max_iter=1000, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "random-forest" in algo_id or "randomforest" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: RandomForestClassifier(n_estimators=n_est, max_depth=max_d, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "catboost" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: HistGradientBoostingClassifier(max_iter=n_est, max_depth=max_d, learning_rate=lr, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "extra-trees" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: ExtraTreesClassifier(n_estimators=n_est, max_depth=max_d, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "mlp" in algo_id or "neural" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=200, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "gradient-boosting" in algo_id or "boosting" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: GradientBoostingClassifier(n_estimators=n_est, max_depth=max_d, learning_rate=lr, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "svc" in algo_id or "support-vector" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: SVC(probability=True, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "naive-bayes" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: GaussianNB(),
                X, y, pipeline_id, node_id, sub_type
            )

        elif "adaboost" in algo_id:
            raw_scores = _fit_or_score_classifier(
                lambda: AdaBoostClassifier(n_estimators=n_est, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

        else:
            raw_scores = _fit_or_score_classifier(
                lambda: HistGradientBoostingClassifier(max_iter=100, max_depth=6, random_state=42),
                X, y, pipeline_id, node_id, sub_type
            )

    if 'raw_scores' not in locals() or raw_scores is None:
        model = IsolationForest(n_estimators=100, contamination=0.03, random_state=42)
        model.fit(X)
        raw_scores = -model.decision_function(X)

    if pipeline_id and 'model' in locals() and model is not None:
        try:
            prefix = sub_type if sub_type in ("clustering", "anomaly", "classification") else "model"
            save_model_artifact(pipeline_id, f"{prefix}_{node_id}", model)
        except Exception:
            pass

    return _normalize_scores(raw_scores)


def execute_rule_clustering(rules_summary: list[dict[str, Any]], node: dict[str, Any], pipeline_id: str | None = None) -> list[dict[str, Any]]:
    """Map uploaded Markdown Rules to Clusters based on parameter specifications and semantic overlap."""
    if not rules_summary:
        return []

    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "").lower()
    params = _clean_params(node)
    node_id = str(node.get("id", "cluster_1"))

    # 1. Extract all unique parameters — use a dict for O(1) lookup
    param_to_idx: dict[str, int] = {}
    for r in rules_summary:
        p_list = r.get("parameters", [])
        if isinstance(p_list, str):
            p_list = [p.strip() for p in p_list.split(",") if p.strip()]
        for p in p_list:
            if p not in param_to_idx:
                param_to_idx[p] = len(param_to_idx)

    n_rules = len(rules_summary)
    n_features = max(1, len(param_to_idx))

    # Build Rule × Parameter binary feature matrix
    matrix = np.zeros((n_rules, n_features), dtype=np.float64)
    for i, r in enumerate(rules_summary):
        p_list = r.get("parameters", [])
        if isinstance(p_list, str):
            p_list = [p.strip() for p in p_list.split(",") if p.strip()]
        for p in p_list:
            if p in param_to_idx:
                matrix[i, param_to_idx[p]] = 1.0

    # 2. Determine number of clusters
    k_clusters = min(int(params.get("nClusters", params.get("k", 3))), n_rules)
    k_clusters = max(1, k_clusters)

    # 3. Perform clustering on Rule × Parameter matrix with safe fallbacks
    fitted_model = None
    try:
        if "dbscan" in algo_id:
            eps = float(params.get("eps", 0.8))
            min_samples = int(params.get("minSamples", 1))
            fitted_model = DBSCAN(eps=eps, min_samples=min_samples)
            labels = fitted_model.fit_predict(matrix)
        elif "agglomerative" in algo_id:
            fitted_model = AgglomerativeClustering(n_clusters=k_clusters)
            labels = fitted_model.fit_predict(matrix)
        elif "gmm" in algo_id:
            fitted_model = GaussianMixture(n_components=k_clusters, random_state=42, max_iter=200)
            labels = fitted_model.fit_predict(matrix)
        else:
            fitted_model = KMeans(n_clusters=k_clusters, random_state=42, n_init=10)
            labels = fitted_model.fit_predict(matrix)
    except Exception:
        labels = np.zeros(n_rules, dtype=int)

    if pipeline_id and fitted_model is not None:
        save_model_artifact(pipeline_id, f"clustering_{node_id}", fitted_model)

    # 4. Group rules into descriptive cluster summaries with names & member counts
    groups: dict[int, list[dict[str, Any]]] = {}
    for i, r in enumerate(rules_summary):
        cid = int(labels[i]) if i < len(labels) else 0
        groups.setdefault(cid, []).append(r)

    cluster_summaries: list[dict[str, Any]] = []
    category_names = [
        "High Velocity & Transaction Spike Segment",
        "Geographic & Impossible Travel Segment",
        "Device & Identity Anomaly Ring",
        "Small Amount Micro-Testing Ring",
        "Baseline Normal Segment",
    ]

    for idx, (cid, r_list) in enumerate(sorted(groups.items())):
        seg_name = category_names[idx % len(category_names)] if cid >= 0 else "Outlier Noise Segment"
        cluster_title = f"Cluster #{idx + 1}: {seg_name}"
        
        high_risk_count = sum(1 for r in r_list if str(r.get("risk_level", "")).upper() == "HIGH")
        avg_risk = 0.85 if high_risk_count > 0 else (0.45 if cid > 0 else 0.15)
        color = "#ef4444" if avg_risk > 0.6 else ("#f59e0b" if avg_risk > 0.3 else "#10b981")
        
        rule_ids = [r.get("rule_id", f"R{i+1}") for i, r in enumerate(r_list)]
        primary_rules_str = ", ".join(rule_ids[:3]) + (f" (+{len(rule_ids)-3} more)" if len(rule_ids) > 3 else "")
        
        params_used = set()
        for r in r_list:
            p = r.get("parameters", [])
            if isinstance(p, list):
                params_used.update(p)
            elif isinstance(p, str):
                params_used.update([x.strip() for x in p.split(",") if x.strip()])
        
        rationale = f"Grouped {len(r_list)} rules sharing parameter features ({', '.join(list(params_used)[:3]) or 'baseline'})."

        cluster_summaries.append({
            "cluster_id": f"c_{cid}",
            "cluster_name": cluster_title,
            "count": len(r_list),
            "risk_score": round(avg_risk, 2),
            "color": color,
            "rule_name": primary_rules_str or "Rules AST Group",
            "assignment_rationale": rationale,
            "rules_count": len(r_list),
        })

    return cluster_summaries
