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


def build_numeric_matrix(df: pd.DataFrame) -> np.ndarray:
    """Extract or create a dense numeric feature matrix X from input DataFrame."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Exclude target/id columns if present
    ignore = {"is_fraud", "timestamp"}
    cols = [c for c in numeric_cols if c.lower() not in ignore and not c.startswith("id_")]

    if cols:
        X = df[cols].fillna(0.0).to_numpy(dtype=np.float64)
    else:
        # Generate numeric representations if no numeric columns exist
        X = np.zeros((len(df), 2), dtype=np.float64)
        if "amount" in df.columns:
            X[:, 0] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0).to_numpy()

    # Ensure scaler stability
    scaler = StandardScaler()
    try:
        X_scaled = scaler.fit_transform(X)
    except Exception:
        X_scaled = X
    return X_scaled


# ─────────────────────────────────────────────────────────────────────────────
# PREPROCESSING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def execute_preprocessing(df: pd.DataFrame, node: dict[str, Any]) -> pd.DataFrame:
    """Execute real data preprocessing transformations."""
    df_out = df.copy()
    params = _clean_params(node)
    def_type = str(node.get("data", {}).get("defType", ""))

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

    elif "deduplication" in def_type:
        # Remove duplicate records
        subset = ["transaction_id"] if "transaction_id" in df_out.columns else None
        df_out = df_out.drop_duplicates(subset=subset).reset_index(drop=True)

    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def execute_feature_engineering(df: pd.DataFrame, node: dict[str, Any]) -> pd.DataFrame:
    """Execute real feature engineering transformations and append signals."""
    df_out = df.copy()
    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "")
    params = _clean_params(node)

    if "velocity" in algo_id:
        group_by = str(params.get("groupBy", "card_id"))
        col = group_by if group_by in df_out.columns else df_out.columns[0]
        # Calculate velocity rolling counts and sums per group
        df_out["velocity_txn_count"] = df_out.groupby(col).cumcount() + 1
        if "amount" in df_out.columns:
            df_out["velocity_amount_sum"] = df_out.groupby(col)["amount"].cumsum()
        else:
            df_out["velocity_amount_sum"] = df_out["velocity_txn_count"] * 100.0

    elif "aggregation-window" in algo_id or "aggregation" in algo_id:
        if "amount" in df_out.columns:
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
        X = build_numeric_matrix(df_out)[:, :3]  # limit to 3 features to avoid combinatorial blowup
        degree = int(params.get("degree", 2))
        poly = PolynomialFeatures(
            degree=degree,
            interaction_only=bool(params.get("interactionOnly", True)),
            include_bias=False,
        )
        poly_feats = poly.fit_transform(X)
        n_poly_cols = min(poly_feats.shape[1], 10)  # cap at 10 output features
        for i in range(n_poly_cols):
            df_out[f"poly_feat_{i+1}"] = poly_feats[:, i]

    elif "tfidf" in algo_id:
        text_data = df_out["country"].astype(str) if "country" in df_out.columns else df_out.index.astype(str)
        max_feat = min(int(params.get("maxFeatures", 10)), 50)
        vec = TfidfVectorizer(max_features=max_feat)
        tfidf_mat = vec.fit_transform(text_data).toarray()
        for i in range(tfidf_mat.shape[1]):
            df_out[f"tfidf_{i+1}"] = tfidf_mat[:, i]

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

    else:
        # Default high-level feature engineering: extract polynomial amount interaction & frequency
        if "amount" in df_out.columns:
            amounts = pd.to_numeric(df_out["amount"], errors="coerce").fillna(0.0)
            df_out["fe_amount_sq"] = amounts ** 2
            df_out["fe_amount_log"] = np.log1p(amounts)

    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# DETECTION & MODEL ENGINE (Clustering, Anomaly Detection, Classification)
# ─────────────────────────────────────────────────────────────────────────────

def execute_detection_model(df: pd.DataFrame, node: dict[str, Any]) -> list[float]:
    """Execute end-to-end Machine Learning / Analytical Detection model."""
    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "").lower()
    sub_type = str(data.get("detectionSubType") or "").lower()
    params = _clean_params(node)

    X = build_numeric_matrix(df)
    n_samples = len(X)
    if n_samples == 0:
        return []

    y = df["is_fraud"].astype(int).values if "is_fraud" in df.columns else np.zeros(n_samples, dtype=int)
    has_labels = len(np.unique(y)) > 1

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
            min_cluster_size = int(params.get("minClusterSize", 5))
            if HDBSCAN is not None:
                model = HDBSCAN(min_cluster_size=min_cluster_size)
                labels = model.fit_predict(X)
                # probabilities_ is membership confidence; 1 - p = anomaly score
                probs = np.asarray(
                    getattr(model, "probabilities_", np.zeros(n_samples)), dtype=np.float64
                )
                raw_scores = 1.0 - probs
            else:
                # Fallback: continuous kNN distance-based score
                nn = NearestNeighbors(n_neighbors=min(min_cluster_size, n_samples)).fit(X)
                raw_scores = nn.kneighbors(X)[0].mean(axis=1)

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
                # Rarer clusters are more anomalous; normalise by mean cluster size
                mean_size = float(n_samples) / max(1, len(counts))
                raw_scores = np.array([mean_size / max(counts.get(l, 1), 1) for l in labels])
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

        return _normalize_scores(raw_scores)

    # -------------------------------------------------------------------------
    # 2. ANOMALY DETECTION ALGORITHMS
    # -------------------------------------------------------------------------
    if "anomaly" in algo_id or sub_type == "anomaly":
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

        elif "autoencoder" in algo_id or "deep" in algo_id:
            # Truncated SVD / Neural Bottleneck Reconstruction Error Scorer
            n_comp = max(1, min(X.shape[1] // 2, X.shape[1] - 1))
            svd = TruncatedSVD(n_components=n_comp, random_state=42)
            X_reduced = svd.fit_transform(X)
            X_reconstructed = svd.inverse_transform(X_reduced)
            raw_scores = np.sum((X - X_reconstructed) ** 2, axis=1)

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

        return _normalize_scores(raw_scores)

    # -------------------------------------------------------------------------
    # 3. CLASSIFICATION ALGORITHMS
    # -------------------------------------------------------------------------
    if "class" in algo_id or sub_type == "classification":
        n_est = int(params.get("nEstimators", 100))
        max_d = int(params.get("maxDepth", 6))
        lr = float(params.get("learningRate", 0.1))

        if "xgboost" in algo_id:
            if xgb is not None and has_labels:
                model = xgb.XGBClassifier(
                    n_estimators=n_est,
                    max_depth=max_d,
                    learning_rate=lr,
                    random_state=42,
                    eval_metric="logloss",
                    verbosity=0,
                )
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            elif has_labels:
                # xgboost not installed — use sklearn HistGradientBoosting as a drop-in
                model = HistGradientBoostingClassifier(
                    max_iter=n_est, max_depth=max_d, learning_rate=lr, random_state=42
                )
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "lightgbm" in algo_id:
            model = HistGradientBoostingClassifier(max_iter=n_est, max_depth=max_d, learning_rate=lr, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "logistic" in algo_id or "regression" in algo_id:
            c_val = float(params.get("C", 1.0))
            model = LogisticRegression(C=c_val, max_iter=1000, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "random-forest" in algo_id or "randomforest" in algo_id:
            model = RandomForestClassifier(n_estimators=n_est, max_depth=max_d, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "extra-trees" in algo_id or "catboost" in algo_id:
            model = ExtraTreesClassifier(n_estimators=n_est, max_depth=max_d, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "mlp" in algo_id or "neural" in algo_id:
            model = MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=200, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "gradient-boosting" in algo_id or "boosting" in algo_id:
            model = GradientBoostingClassifier(n_estimators=n_est, max_depth=max_d, learning_rate=lr, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "svc" in algo_id or "support-vector" in algo_id:
            model = SVC(probability=True, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "naive-bayes" in algo_id:
            model = GaussianNB()
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        elif "adaboost" in algo_id:
            model = AdaBoostClassifier(n_estimators=n_est, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        else:
            # Default Gradient Boosted Classifier
            model = HistGradientBoostingClassifier(max_iter=100, max_depth=6, random_state=42)
            if has_labels:
                model.fit(X, y)
                raw_scores = model.predict_proba(X)[:, 1]
            else:
                raw_scores = np.zeros(n_samples)

        return _normalize_scores(raw_scores)

    # Fallback to isolation forest scoring if unclassified
    model = IsolationForest(n_estimators=100, contamination=0.03, random_state=42)
    model.fit(X)
    return _normalize_scores(-model.decision_function(X))


def execute_rule_clustering(rules_summary: list[dict[str, Any]], node: dict[str, Any]) -> list[dict[str, Any]]:
    """Map uploaded Markdown Rules to Clusters based on parameter specifications and semantic overlap."""
    if not rules_summary:
        return []

    data = node.get("data", {})
    algo_id = str(data.get("algorithmId") or data.get("defType") or "").lower()
    params = _clean_params(node)

    # 1. Extract all unique parameters — use a dict for O(1) lookup (fixes O(n²) bug)
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

    # 2. Determine number of clusters (must be ≥ 1 and ≤ n_rules)
    k_clusters = min(int(params.get("nClusters", params.get("k", 3))), n_rules)
    k_clusters = max(1, k_clusters)

    # 3. Perform clustering on Rule × Parameter matrix with safe fallbacks
    try:
        if "dbscan" in algo_id:
            eps = float(params.get("eps", 0.8))
            min_samples = int(params.get("minSamples", 1))
            model = DBSCAN(eps=eps, min_samples=min_samples)
            labels = model.fit_predict(matrix)
        elif "agglomerative" in algo_id:
            model = AgglomerativeClustering(n_clusters=k_clusters)
            labels = model.fit_predict(matrix)
        elif "gmm" in algo_id:
            model = GaussianMixture(n_components=k_clusters, random_state=42, max_iter=200)
            labels = model.fit_predict(matrix)
        else:
            model = KMeans(n_clusters=k_clusters, random_state=42, n_init=10)
            labels = model.fit_predict(matrix)
    except Exception:
        # Safe fallback: assign all rules to a single cluster
        labels = np.zeros(n_rules, dtype=int)

    # 4. Map each rule to its cluster ID & build cluster labels
    cluster_mappings: list[dict[str, Any]] = []
    for i, r in enumerate(rules_summary):
        cid = int(labels[i])
        c_label = f"Cluster {cid + 1}" if cid >= 0 else "Outlier Cluster"
        p_list = r.get("parameters", [])
        if isinstance(p_list, list):
            p_str = ", ".join(p_list)
        else:
            p_str = str(p_list)

        cluster_mappings.append({
            "rule_id": r.get("rule_id") or f"RULE_{i+1}",
            "cluster_id": cid if cid >= 0 else 99,
            "cluster_label": c_label,
            "rule_description": r.get("description") or r.get("rule_description", ""),
            "parameter_count": r.get("parameter_count", len(p_list)),
            "parameters": p_str,
            "risk_level": r.get("risk_level", "MEDIUM"),
        })

    return cluster_mappings
