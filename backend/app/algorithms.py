"""AlgorithmRegistry — single source of truth for feature-engineering and
detection algorithm metadata (ids, parameter schemas, etc.).

Exposed via the REST endpoints in main.py:
  GET /algorithms/{category}  -> list of summaries for a category
  GET /algorithms/{id}        -> full algorithm detail (with parameter schema)

The frontend Pipeline Studio fetches these live so newly registered
algorithms appear in the dropdown with zero frontend changes.
"""
from typing import Any

CATEGORIES = [
    "feature-engineering",
    "clustering",
    "anomaly-detection",
    "classification",
]


def _p(name, type_, default, hint, **extra):
    d = {"name": name, "type": type_, "default": default, "hint": hint}
    d.update(extra)
    return d


REGISTRY: list[dict[str, Any]] = [
    # ─────────────────────── FEATURE ENGINEERING ───────────────────────
    {
        "id": "feat.velocity-features",
        "name": "Velocity Features",
        "category": "feature-engineering",
        "oneLine": "Derives rate-of-change signals over short rolling windows (count, sum, distinct merchants).",
        "complexity": "Low",
        "inputType": "Time Series",
        "outputType": "Feature Set",
        "stability": "Stable",
        "version": "v1.3",
        "advantages": [
            "Captures burst behaviour that single-row features miss, e.g. 10 swipes in 90 seconds.",
            "Cheap to compute with incremental aggregation, scales to streaming workloads.",
            "Highly interpretable — analysts understand 'txn count last 5 min' immediately.",
        ],
        "disadvantages": [
            "Window size is a strong prior; too short misses slow fraud, too long drowns fast fraud.",
            "Cold-start for new cardholders yields zero history and noisy velocity.",
        ],
        "parameters": [
            _p("windowSeconds", "integer", 300, "Length of the rolling window used to compute velocity.", min=30, max=86400, step=30),
            _p("aggregations", "enum", "count,sum,distinct_merchants", "Which aggregates to emit per window.", options=["count,sum,distinct_merchants", "count,sum", "count"]),
            _p("groupBy", "enum", "card_id", "Entity whose velocity is being measured.", options=["card_id", "account_id", "device_id", "merchant_id"]),
        ],
        "exampleUseCase": "Flags card-testing where 40+ declines hit one card within two minutes.",
    },
    {
        "id": "feat.aggregation-window",
        "name": "Aggregation Window Features",
        "category": "feature-engineering",
        "oneLine": "Builds time-windowed aggregates (mean, max, std) over customer / merchant history.",
        "complexity": "Low",
        "inputType": "Time Series",
        "outputType": "Feature Set",
        "stability": "Stable",
        "version": "v1.2",
        "advantages": [
            "Establishes the behavioural baseline each transaction is compared against.",
            "Multi-window variants (1h / 24h / 7d) capture both sudden and gradual drift.",
            "Pairs well with almost every downstream detector without re-engineering.",
        ],
        "disadvantages": [
            "Long windows require durable state; memory grows with active entities.",
            "Leaky if windows include the current transaction — must be point-in-time safe.",
        ],
        "parameters": [
            _p("windowHours", "integer", 24, "Window length in hours for the aggregate.", min=1, max=720, step=1),
            _p("functions", "enum", "mean,max,std", "Aggregate functions applied over the window.", options=["mean,max,std", "mean,std", "max,min,mean,std", "sum"]),
            _p("includeCurrent", "boolean", False, "Include the current transaction in its own window (usually false to avoid leakage)."),
        ],
        "exampleUseCase": "Lets an Isolation Forest see that a $4,000 transfer is 8x the customer's 30-day mean.",
    },
    {
        "id": "feat.mutual-information-selection",
        "name": "Mutual Information Selection",
        "category": "feature-engineering",
        "oneLine": "Ranks features by mutual information with the fraud label to drop irrelevant ones.",
        "complexity": "Medium",
        "inputType": "Feature Set",
        "outputType": "Feature Set",
        "stability": "Beta",
        "version": "v0.9",
        "advantages": [
            "Captures nonlinear dependence, unlike correlation-based filters.",
            "Model-agnostic — the selected subset transfers across multiple detectors.",
            "Reduces dimensionality before costly detectors like Autoencoder or OCSVM.",
        ],
        "disadvantages": [
            "Requires labelled data, so it cannot run in fully unsupervised pipelines.",
            "MI estimation is noisy on small samples and can over-rank spurious features.",
        ],
        "parameters": [
            _p("kFeatures", "integer", 20, "Number of top features to keep.", min=1, max=200, step=1),
            _p("discretize", "boolean", True, "Discretize continuous features before estimating MI."),
            _p("randomState", "integer", 42, "Seed for reproducible selection.", min=0, max=999, step=1),
        ],
        "exampleUseCase": "Drops 60 of 80 raw fields before training XGBoost, cutting training time in half.",
    },
    {
        "id": "feat.pca",
        "name": "PCA",
        "category": "feature-engineering",
        "oneLine": "Linear dimensionality reduction via principal components for dense numeric features.",
        "complexity": "Medium",
        "inputType": "Feature Set",
        "outputType": "Feature Set",
        "stability": "Stable",
        "version": "v1.4",
        "advantages": [
            "Removes multicollinearity that destabilises linear classifiers.",
            "Truncated components compress high-dimensional data for faster training.",
            "Whitening yields unit-variance inputs that help distance-based detectors.",
        ],
        "disadvantages": [
            "Components are linear combos, hurting explainability required for banking audits.",
            "Sensitive to feature scale — must standardise inputs first.",
            "Can discard low-variance but fraud-discriminative directions.",
        ],
        "parameters": [
            _p("nComponents", "integer", 10, "Number of principal components to keep.", min=2, max=100, step=1),
            _p("whiten", "boolean", False, "Scale components to unit variance (useful for downstream distance methods)."),
            _p("svdSolver", "enum", "auto", "SVD solver strategy.", options=["auto", "full", "arpack", "randomized"]),
        ],
        "exampleUseCase": "Compresses 50 merchant-category dummies into 8 components feeding a One-Class SVM.",
    },
    {
        "id": "feat.chi-square-selection",
        "name": "Chi-Square Selection",
        "category": "feature-engineering",
        "oneLine": "Selects non-negative categorical features by chi-square independence with the label.",
        "complexity": "Low",
        "inputType": "Feature Set",
        "outputType": "Feature Set",
        "stability": "Stable",
        "version": "v1.1",
        "advantages": [
            "Fast statistical test ideal for one-hot / count features like MCC codes.",
            "No distributional assumptions beyond non-negativity.",
            "Output is a ranked, auditable feature list — good for compliance.",
        ],
        "disadvantages": [
            "Only valid for non-negative features; unsuitable for signed or continuous values.",
            "Assumes independence of observations, violated by repeated cardholder rows.",
        ],
        "parameters": [
            _p("kFeatures", "integer", 15, "Number of top features to retain.", min=1, max=200, step=1),
            _p("scoreFunc", "enum", "chi2", "Scoring function used to rank features.", options=["chi2", "mutual_info_classif"]),
        ],
        "exampleUseCase": "Keeps the 15 merchant-category flags most associated with confirmed chargebacks.",
    },
    # ─────────────────────────── CLUSTERING ─────────────────────────────
    {
        "id": "det.cluster.dbscan",
        "name": "DBSCAN",
        "category": "clustering",
        "oneLine": "Density-based clustering that finds arbitrarily shaped clusters and marks low-density points as noise.",
        "complexity": "Medium",
        "inputType": "Vector",
        "outputType": "Labels",
        "stability": "Stable",
        "version": "v1.2",
        "advantages": [
            "Discovers non-spherical clusters (geographic rings, time bursts) without presetting k.",
            "Native noise label isolates sparse outliers that often correspond to fraud.",
            "Robust to outliers since they don't skew centroids.",
        ],
        "disadvantages": [
            "Sensitive to eps and min_samples; poor choices merge or shred clusters.",
            "Struggles with varying density — a single global eps misses multi-scale rings.",
            "Indexing degrades on high-dimensional data, slowing neighbour queries.",
        ],
        "parameters": [
            _p("eps", "number", 0.5, "Maximum distance between two samples to be in the same neighbourhood.", min=0.01, max=5, step=0.01),
            _p("minSamples", "integer", 5, "Points needed to form a dense region (core point).", min=1, max=100, step=1),
            _p("metric", "enum", "euclidean", "Distance metric; haversine for lat/long ring detection.", options=["euclidean", "manhattan", "haversine"]),
        ],
        "exampleUseCase": "Groups transactions by geographic + velocity similarity to surface card-testing rings.",
    },
    {
        "id": "det.cluster.hdbscan",
        "name": "HDBSCAN",
        "category": "clustering",
        "oneLine": "Hierarchical density clustering that auto-selects clusters across varying densities.",
        "complexity": "High",
        "inputType": "Vector",
        "outputType": "Labels",
        "stability": "Beta",
        "version": "v0.8",
        "advantages": [
            "Handles variable density that defeats DBSCAN's single eps.",
            "Only min_cluster_size is critical — far less tuning than DBSCAN.",
            "Produces a soft cluster-membership score for borderline transactions.",
        ],
        "disadvantages": [
            "Slower than DBSCAN on very large transaction sets.",
            "Hierarchical extraction can still over-merge when densities are ambiguous.",
        ],
        "parameters": [
            _p("minClusterSize", "integer", 10, "Smallest grouping to treat as a cluster.", min=2, max=500, step=1),
            _p("minSamples", "integer", 5, "Controls how conservative core-distance estimation is.", min=1, max=200, step=1),
            _p("clusterSelectionMethod", "enum", "eom", "eom favours broader clusters; leaf favours smaller, tighter ones.", options=["eom", "leaf"]),
        ],
        "exampleUseCase": "Surfaces multi-density fraud cohorts that a single-eps DBSCAN would split or merge.",
    },
    {
        "id": "det.cluster.graph-community",
        "name": "Graph-Based Community Detection",
        "category": "clustering",
        "oneLine": "Builds a transaction / entity graph and detects communities to expose fraud networks.",
        "complexity": "High",
        "inputType": "Graph",
        "outputType": "Labels",
        "stability": "Beta",
        "version": "v0.7",
        "advantages": [
            "Surfaces synthetic-id and bust-out rings that share cards, devices, or addresses.",
            "Uses relational structure invisible to row-based models.",
            "Community membership is itself a strong, explainable feature for downstream scorers.",
        ],
        "disadvantages": [
            "Requires constructing and maintaining a large entity graph.",
            "Community quality depends heavily on edge definition and resolution parameter.",
            "Harder to explain to a non-technical reviewer than a centroid cluster.",
        ],
        "parameters": [
            _p("resolution", "number", 1.0, "Lower values favour larger communities; higher values split them.", min=0.1, max=5, step=0.1),
            _p("algorithm", "enum", "louvain", "Community detection algorithm.", options=["louvain", "leiden", "label_propagation"]),
            _p("edgeWeight", "enum", "shared_card", "How edge weight between entities is derived.", options=["shared_card", "shared_device", "shared_address", "txn_amount"]),
        ],
        "exampleUseCase": "Reveals a 14-account bust-out ring sharing one device and a shipping address.",
    },
    {
        "id": "det.cluster.kmeans",
        "name": "KMeans (baseline)",
        "category": "clustering",
        "oneLine": "Partitions transactions into k centroid-based clusters; used as a fast baseline.",
        "complexity": "Low",
        "inputType": "Vector",
        "outputType": "Labels",
        "stability": "Stable",
        "version": "v1.5",
        "advantages": [
            "Very fast and simple — ideal baseline to compare richer clusterers against.",
            "Cluster distance doubles as a lightweight anomaly score.",
            "Deterministic given k and a fixed seed.",
        ],
        "disadvantages": [
            "Requires presetting k, which is unknown for evolving fraud patterns.",
            "Assumes spherical, equal-sized clusters — misses elongated or nested rings.",
            "Sensitive to outliers; centroids drift toward extreme transactions.",
        ],
        "parameters": [
            _p("k", "integer", 8, "Number of clusters (centroids).", min=2, max=100, step=1),
            _p("init", "enum", "k-means++", "Centroid initialisation strategy.", options=["k-means++", "random"]),
            _p("nInit", "integer", 10, "Number of restarts; higher reduces local minima.", min=1, max=50, step=1),
            _p("randomState", "integer", 42, "Seed for reproducibility.", min=0, max=999, step=1),
        ],
        "exampleUseCase": "Establishes a baseline behavioural segmentation before comparing HDBSCAN ring output.",
    },
    # ─────────────────────── ANOMALY DETECTION ───────────────────────────
    {
        "id": "det.anomaly.isolation-forest",
        "name": "Isolation Forest",
        "category": "anomaly-detection",
        "oneLine": "Isolates anomalies via random partition trees; anomalies need fewer splits to separate.",
        "complexity": "Medium",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.3",
        "advantages": [
            "Fast and scales well to millions of transactions.",
            "No need for a clean 'normal' set — works unsupervised.",
            "Low memory footprint; easy to retrain on rolling windows.",
        ],
        "disadvantages": [
            "Struggles with high-dimensional sparse fraud features (one-hot MCC, merchant ids).",
            "Random splits make scores jittery across retraining runs without a fixed seed.",
            "Less effective when fraud is dense enough to look 'normal'.",
        ],
        "parameters": [
            _p("nEstimators", "integer", 100, "Number of isolation trees in the forest.", min=10, max=1000, step=10),
            _p("contamination", "number", 0.02, "Expected fraction of anomalies in the data.", min=0.001, max=0.5, step=0.001),
            _p("maxSamples", "enum", "auto", "Subsample size drawn to train each tree.", options=["auto", "256", "512", "1024"]),
        ],
        "exampleUseCase": "Scores each transaction for isolation depth; the shallowest 2% are auto-flagged.",
    },
    {
        "id": "det.anomaly.lof",
        "name": "Local Outlier Factor (LOF)",
        "category": "anomaly-detection",
        "oneLine": "Scores local density deviation; flags points much sparser than their neighbours.",
        "complexity": "Medium",
        "inputType": "Vector",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.2",
        "advantages": [
            "Detects local anomalies global methods miss — a small spend in a high-value cohort.",
            "No training phase; scores are computed at query time.",
            "Score magnitude is interpretable as a density ratio.",
        ],
        "disadvantages": [
            "k-NN search is expensive on large or high-dimensional data.",
            "Sensitive to the choice of k and the distance metric.",
            "Degrades when density varies widely across the dataset.",
        ],
        "parameters": [
            _p("nNeighbors", "integer", 20, "Number of neighbours used for local density.", min=2, max=200, step=1),
            _p("contamination", "number", 0.02, "Expected fraction of anomalies.", min=0.001, max=0.5, step=0.001),
            _p("metric", "enum", "euclidean", "Distance metric for neighbour search.", options=["euclidean", "manhattan", "minkowski"]),
        ],
        "exampleUseCase": "Catches a $200 test charge that is anomalous only within a high-spend cardholder's history.",
    },
    {
        "id": "det.anomaly.autoencoder",
        "name": "Autoencoder",
        "category": "anomaly-detection",
        "oneLine": "Neural net trained to reconstruct normal data; high reconstruction error signals fraud.",
        "complexity": "High",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Beta",
        "version": "v0.9",
        "advantages": [
            "Learns nonlinear normal-behaviour manifolds that linear models can't.",
            "Captures complex feature interactions without manual feature engineering.",
            "Reconstruction error per feature helps explain which signal drove the score.",
        ],
        "disadvantages": [
            "Needs a clean-ish normal training set; fraud in training corrupts the model.",
            "Training cost and hyperparameter tuning are significant.",
            "Less explainable than tree or linear methods for audit purposes.",
        ],
        "parameters": [
            _p("encodingDim", "integer", 16, "Size of the latent bottleneck layer.", min=2, max=128, step=1),
            _p("epochs", "integer", 50, "Training epochs on the normal-only set.", min=1, max=500, step=1),
            _p("threshold", "number", 0.95, "Reconstruction-error percentile above which a row is flagged.", min=0.5, max=0.999, step=0.001),
            _p("activation", "enum", "relu", "Hidden layer activation.", options=["relu", "tanh", "sigmoid"]),
        ],
        "exampleUseCase": "Reconstructs each transaction; the top 5% by error go to analyst review.",
    },
    {
        "id": "det.anomaly.one-class-svm",
        "name": "One-Class SVM",
        "category": "anomaly-detection",
        "oneLine": "Learns a boundary around normal data in kernel space; points outside are anomalies.",
        "complexity": "High",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.1",
        "advantages": [
            "Flexible nonlinear boundary via the kernel trick.",
            "Works in purely unsupervised settings with no labels.",
            "Decision distance to the boundary is a continuous, rankable score.",
        ],
        "disadvantages": [
            "O(n^2) kernel computation scales poorly past tens of thousands of rows.",
            "Very sensitive to nu and gamma; small changes reshape the boundary.",
            "Kernel methods struggle with very high-dimensional sparse features.",
        ],
        "parameters": [
            _p("nu", "number", 0.05, "Upper bound on training errors and lower bound on support vectors.", min=0.001, max=0.5, step=0.001),
            _p("kernel", "enum", "rbf", "Kernel function for the boundary.", options=["rbf", "linear", "poly", "sigmoid"]),
            _p("gamma", "enum", "scale", "RBF / poly kernel coefficient.", options=["scale", "auto"]),
        ],
        "exampleUseCase": "Boundaries the normal spending region for a merchant portfolio; out-of-region txns are flagged.",
    },
    # ───────────────────────── CLASSIFICATION ───────────────────────────
    {
        "id": "det.class.xgboost",
        "name": "XGBoost",
        "category": "classification",
        "oneLine": "Gradient-boosted trees; strong, widely-used supervised fraud scorer.",
        "complexity": "High",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.6",
        "advantages": [
            "State-of-the-art accuracy on tabular fraud data.",
            "Handles missing values and mixed feature types natively.",
            "Feature-importance and SHAP outputs support model-agnostic explanation.",
        ],
        "disadvantages": [
            "Many hyperparameters; easy to overfit the rare positive class.",
            "Class imbalance requires careful weighting or sampling.",
            "Slower to train than linear models; less trivial to retrain online.",
        ],
        "parameters": [
            _p("nEstimators", "integer", 200, "Number of boosting rounds.", min=10, max=2000, step=10),
            _p("maxDepth", "integer", 6, "Maximum tree depth.", min=1, max=20, step=1),
            _p("learningRate", "number", 0.1, "Shrinkage applied to each tree.", min=0.001, max=1, step=0.001),
            _p("scalePosWeight", "number", 10, "Weight of the positive (fraud) class to counter imbalance.", min=1, max=100, step=1),
        ],
        "exampleUseCase": "Scores every transaction 0-1; above the threshold it routes to the review queue.",
    },
    {
        "id": "det.class.lightgbm",
        "name": "LightGBM",
        "category": "classification",
        "oneLine": "Leaf-wise gradient boosting; faster and more memory-efficient than XGBoost on large data.",
        "complexity": "High",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.4",
        "advantages": [
            "Trains faster than XGBoost on large transaction volumes.",
            "Histogram-based splits use far less memory.",
            "Native categorical feature support avoids one-hot explosion.",
        ],
        "disadvantages": [
            "Leaf-wise growth can overfit on small datasets.",
            "Sensitive to min_child_samples and num_leaves tuning.",
            "Less ubiquitous tooling than XGBoost in some compliance stacks.",
        ],
        "parameters": [
            _p("nEstimators", "integer", 200, "Number of boosting iterations.", min=10, max=2000, step=10),
            _p("numLeaves", "integer", 31, "Maximum leaves per tree; controls complexity.", min=2, max=256, step=1),
            _p("learningRate", "number", 0.1, "Shrinkage per iteration.", min=0.001, max=1, step=0.001),
            _p("minChildSamples", "integer", 20, "Minimum data in a leaf; higher reduces overfit.", min=1, max=500, step=1),
        ],
        "exampleUseCase": "Scores 50M monthly transactions where XGBoost training time is prohibitive.",
    },
    {
        "id": "det.class.logistic-regression",
        "name": "Logistic Regression",
        "category": "classification",
        "oneLine": "Linear fraud / not-fraud classifier; the explainable, audit-friendly baseline.",
        "complexity": "Low",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.3",
        "advantages": [
            "Highly explainable and audit-friendly for banking compliance.",
            "Fast to train and score; trivial to retrain on new data.",
            "Coefficients give direct feature contribution per decision.",
        ],
        "disadvantages": [
            "Lower accuracy on nonlinear fraud patterns.",
            "Requires careful feature scaling and encoding.",
            "Cannot model interactions without manual feature crosses.",
        ],
        "parameters": [
            _p("penalty", "enum", "l2", "Regularisation type.", options=["l2", "l1", "elasticnet", "none"]),
            _p("C", "number", 1.0, "Inverse regularisation strength; lower = stronger regularisation.", min=0.001, max=100, step=0.001),
            _p("classWeight", "enum", "balanced", "Weighting for the imbalanced fraud class.", options=["balanced", "none"]),
            _p("maxIter", "integer", 200, "Maximum optimisation iterations.", min=50, max=5000, step=50),
        ],
        "exampleUseCase": "Provides the auditable baseline score that regulators compare the XGBoost model against.",
    },
    {
        "id": "det.class.random-forest",
        "name": "Random Forest",
        "category": "classification",
        "oneLine": "Bagged decision trees; robust, low-tuning supervised scorer with good explainability.",
        "complexity": "Medium",
        "inputType": "Feature Set",
        "outputType": "Scores",
        "stability": "Stable",
        "version": "v1.4",
        "advantages": [
            "Robust to outliers and irrelevant features with minimal tuning.",
            "Provides feature importance and per-tree decision paths for audit.",
            "Parallelisable training across trees.",
        ],
        "disadvantages": [
            "Larger model footprint and slower scoring than a single tree.",
            "Less accurate than gradient boosting on most fraud benchmarks.",
            "Can still overfit noisy or high-cardinality categorical features.",
        ],
        "parameters": [
            _p("nEstimators", "integer", 150, "Number of trees in the forest.", min=10, max=1000, step=10),
            _p("maxDepth", "enum", "none", "Maximum tree depth; 'none' grows fully.", options=["none", "10", "20", "30"]),
            _p("maxFeatures", "enum", "sqrt", "Features considered per split.", options=["sqrt", "log2", "0.3", "none"]),
            _p("classWeight", "enum", "balanced_subsample", "Class weighting to counter imbalance.", options=["balanced", "balanced_subsample", "none"]),
        ],
        "exampleUseCase": "A robust fallback scorer when the boosted model is being retrained or audited.",
    },
]

ALGORITHM_BY_ID: dict[str, dict[str, Any]] = {a["id"]: a for a in REGISTRY}


def algorithms_by_category(category: str) -> list[dict[str, Any]]:
    """Summary view (no heavy parameter schema) for dropdown population."""
    out = []
    for a in REGISTRY:
        if a["category"] == category:
            out.append({
                "id": a["id"],
                "name": a["name"],
                "oneLine": a["oneLine"],
                "complexity": a["complexity"],
                "stability": a["stability"],
                "version": a["version"],
            })
    return out
