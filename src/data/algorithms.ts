/**
 * Single source of truth for detection / feature-engineering algorithm
 * metadata. Consumed by BOTH the Algorithm Library route and the Pipeline
 * Studio Properties panel — never duplicate these definitions.
 *
 * Phase 3 scope: metadata + parameter schemas only. No execution logic.
 */

export type AlgorithmTab =
  | "feature-engineering"
  | "clustering"
  | "anomaly-detection"
  | "classification";

export type Complexity = "Low" | "Medium" | "High";
export type Stability = "Stable" | "Beta";
export type IOType =
  | "Tabular"
  | "Vector"
  | "Graph"
  | "Time Series"
  | "Embedding"
  | "Feature Set"
  | "Scores"
  | "Labels";

export type ParamType = "number" | "integer" | "enum" | "boolean" | "string";

export interface ParamDef {
  name: string;
  type: ParamType;
  default: number | string | boolean;
  /** For number/integer: min/max/step. */
  min?: number;
  max?: number;
  step?: number;
  /** For enum: allowed options. */
  options?: string[];
  hint: string;
}

export interface AlgorithmDef {
  id: string;
  name: string;
  tab: AlgorithmTab;
  oneLine: string;
  complexity: Complexity;
  inputType: IOType;
  outputType: IOType;
  stability: Stability;
  version: string;
  advantages: string[];
  disadvantages: string[];
  parameters: ParamDef[];
  exampleUseCase: string;
}

export const ALGORITHM_TABS: Array<{
  id: AlgorithmTab;
  label: string;
  description: string;
}> = [
  {
    id: "feature-engineering",
    label: "Feature Engineering",
    description:
      "Transform raw transactions into the signals that downstream detectors learn from.",
  },
  {
    id: "clustering",
    label: "Clustering",
    description:
      "Group similar transactions to surface rings, networks, and behavioural cohorts.",
  },
  {
    id: "anomaly-detection",
    label: "Anomaly Detection",
    description:
      "Score how far each transaction deviates from learned normal behaviour.",
  },
  {
    id: "classification",
    label: "Classification",
    description:
      "Supervised fraud / not-fraud scorers that learn from labelled cases.",
  },
];

export const ALGORITHMS: AlgorithmDef[] = [
  // ───────────────────────── FEATURE ENGINEERING ─────────────────────────
  {
    id: "feat.velocity-features",
    name: "Velocity Features",
    tab: "feature-engineering",
    oneLine:
      "Derives rate-of-change signals over short rolling windows (count, sum, distinct merchants).",
    complexity: "Low",
    inputType: "Time Series",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.3",
    advantages: [
      "Captures burst behaviour that single-row features miss, e.g. 10 swipes in 90 seconds.",
      "Cheap to compute with incremental aggregation, scales to streaming workloads.",
      "Highly interpretable — analysts understand 'txn count last 5 min' immediately.",
    ],
    disadvantages: [
      "Window size is a strong prior; too short misses slow fraud, too long drowns fast fraud.",
      "Cold-start for new cardholders yields zero history and noisy velocity.",
    ],
    parameters: [
      {
        name: "windowSeconds",
        type: "integer",
        default: 300,
        min: 30,
        max: 86400,
        step: 30,
        hint: "Length of the rolling window used to compute velocity.",
      },
      {
        name: "aggregations",
        type: "enum",
        default: "count,sum,distinct_merchants",
        options: ["count,sum,distinct_merchants", "count,sum", "count"],
        hint: "Which aggregates to emit per window.",
      },
      {
        name: "groupBy",
        type: "enum",
        default: "card_id",
        options: ["card_id", "account_id", "device_id", "merchant_id"],
        hint: "Entity whose velocity is being measured.",
      },
    ],
    exampleUseCase:
      "Flags card-testing where 40+ declines hit one card within two minutes.",
  },
  {
    id: "feat.aggregation-window",
    name: "Aggregation Window Features",
    tab: "feature-engineering",
    oneLine:
      "Builds time-windowed aggregates (mean, max, std) over customer / merchant history.",
    complexity: "Low",
    inputType: "Time Series",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Establishes the behavioural baseline each transaction is compared against.",
      "Multi-window variants (1h / 24h / 7d) capture both sudden and gradual drift.",
      "Pairs well with almost every downstream detector without re-engineering.",
    ],
    disadvantages: [
      "Long windows require durable state; memory grows with active entities.",
      "Leaky if windows include the current transaction — must be point-in-time safe.",
    ],
    parameters: [
      {
        name: "windowHours",
        type: "integer",
        default: 24,
        min: 1,
        max: 720,
        step: 1,
        hint: "Window length in hours for the aggregate.",
      },
      {
        name: "functions",
        type: "enum",
        default: "mean,max,std",
        options: ["mean,max,std", "mean,std", "max,min,mean,std", "sum"],
        hint: "Aggregate functions applied over the window.",
      },
      {
        name: "includeCurrent",
        type: "boolean",
        default: false,
        hint: "Include the current transaction in its own window (usually false to avoid leakage).",
      },
    ],
    exampleUseCase:
      "Lets an Isolation Forest see that a $4,000 transfer is 8x the customer's 30-day mean.",
  },
  {
    id: "feat.mutual-information-selection",
    name: "Mutual Information Selection",
    tab: "feature-engineering",
    oneLine:
      "Ranks features by mutual information with the fraud label to drop irrelevant ones.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Feature Set",
    stability: "Beta",
    version: "v0.9",
    advantages: [
      "Captures nonlinear dependence, unlike correlation-based filters.",
      "Model-agnostic — the selected subset transfers across multiple detectors.",
      "Reduces dimensionality before costly detectors like Autoencoder or OCSVM.",
    ],
    disadvantages: [
      "Requires labelled data, so it cannot run in fully unsupervised pipelines.",
      "MI estimation is noisy on small samples and can over-rank spurious features.",
    ],
    parameters: [
      {
        name: "kFeatures",
        type: "integer",
        default: 20,
        min: 1,
        max: 200,
        step: 1,
        hint: "Number of top features to keep.",
      },
      {
        name: "discretize",
        type: "boolean",
        default: true,
        hint: "Discretize continuous features before estimating MI.",
      },
      {
        name: "randomState",
        type: "integer",
        default: 42,
        min: 0,
        max: 999,
        step: 1,
        hint: "Seed for reproducible selection.",
      },
    ],
    exampleUseCase:
      "Drops 60 of 80 raw fields before training XGBoost, cutting training time in half.",
  },
  {
    id: "feat.pca",
    name: "PCA",
    tab: "feature-engineering",
    oneLine:
      "Linear dimensionality reduction via principal components for dense numeric features.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.4",
    advantages: [
      "Removes multicollinearity that destabilises linear classifiers.",
      "Truncated components compress high-dimensional data for faster training.",
      "Whitening yields unit-variance inputs that help distance-based detectors.",
    ],
    disadvantages: [
      "Components are linear combos, hurting explainability required for banking audits.",
      "Sensitive to feature scale — must standardise inputs first.",
      "Can discard low-variance but fraud-discriminative directions.",
    ],
    parameters: [
      {
        name: "nComponents",
        type: "integer",
        default: 10,
        min: 2,
        max: 100,
        step: 1,
        hint: "Number of principal components to keep.",
      },
      {
        name: "whiten",
        type: "boolean",
        default: false,
        hint: "Scale components to unit variance (useful for downstream distance methods).",
      },
      {
        name: "svdSolver",
        type: "enum",
        default: "auto",
        options: ["auto", "full", "arpack", "randomized"],
        hint: "SVD solver strategy.",
      },
    ],
    exampleUseCase:
      "Compresses 50 merchant-category dummies into 8 components feeding a One-Class SVM.",
  },
  {
    id: "feat.chi-square-selection",
    name: "Chi-Square Selection",
    tab: "feature-engineering",
    oneLine:
      "Selects non-negative categorical features by chi-square independence with the label.",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Fast statistical test ideal for one-hot / count features like MCC codes.",
      "No distributional assumptions beyond non-negativity.",
      "Output is a ranked, auditable feature list — good for compliance.",
    ],
    disadvantages: [
      "Only valid for non-negative features; unsuitable for signed or continuous values.",
      "Assumes independence of observations, violated by repeated cardholder rows.",
    ],
    parameters: [
      {
        name: "kFeatures",
        type: "integer",
        default: 15,
        min: 1,
        max: 200,
        step: 1,
        hint: "Number of top features to retain.",
      },
      {
        name: "scoreFunc",
        type: "enum",
        default: "chi2",
        options: ["chi2", "mutual_info_classif"],
        hint: "Scoring function used to rank features.",
      },
    ],
    exampleUseCase:
      "Keeps the 15 merchant-category flags most associated with confirmed chargebacks.",
  },

  // ───────────────────────────── CLUSTERING ──────────────────────────────
  {
    id: "det.cluster.dbscan",
    name: "DBSCAN",
    tab: "clustering",
    oneLine:
      "Density-based clustering that finds arbitrarily shaped clusters and marks low-density points as noise.",
    complexity: "Medium",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Discovers non-spherical clusters (geographic rings, time bursts) without presetting k.",
      "Native noise label isolates sparse outliers that often correspond to fraud.",
      "Robust to outliers since they don't skew centroids.",
    ],
    disadvantages: [
      "Sensitive to eps and min_samples; poor choices merge or shred clusters.",
      "Struggles with varying density — a single global eps misses multi-scale rings.",
      "Indexing degrades on high-dimensional data, slowing neighbour queries.",
    ],
    parameters: [
      {
        name: "eps",
        type: "number",
        default: 0.5,
        min: 0.01,
        max: 5,
        step: 0.01,
        hint: "Maximum distance between two samples to be in the same neighbourhood.",
      },
      {
        name: "minSamples",
        type: "integer",
        default: 5,
        min: 1,
        max: 100,
        step: 1,
        hint: "Points needed to form a dense region (core point).",
      },
      {
        name: "metric",
        type: "enum",
        default: "euclidean",
        options: ["euclidean", "manhattan", "haversine"],
        hint: "Distance metric; haversine for lat/long ring detection.",
      },
    ],
    exampleUseCase:
      "Groups transactions by geographic + velocity similarity to surface card-testing rings.",
  },
  {
    id: "det.cluster.hdbscan",
    name: "HDBSCAN",
    tab: "clustering",
    oneLine:
      "Hierarchical density clustering that auto-selects clusters across varying densities.",
    complexity: "High",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Beta",
    version: "v0.8",
    advantages: [
      "Handles variable density that defeats DBSCAN's single eps.",
      "Only min_cluster_size is critical — far less tuning than DBSCAN.",
      "Produces a soft cluster-membership score for borderline transactions.",
    ],
    disadvantages: [
      "Slower than DBSCAN on very large transaction sets.",
      "Hierarchical extraction can still over-merge when densities are ambiguous.",
    ],
    parameters: [
      {
        name: "minClusterSize",
        type: "integer",
        default: 10,
        min: 2,
        max: 500,
        step: 1,
        hint: "Smallest grouping to treat as a cluster.",
      },
      {
        name: "minSamples",
        type: "integer",
        default: 5,
        min: 1,
        max: 200,
        step: 1,
        hint: "Controls how conservative core-distance estimation is.",
      },
      {
        name: "clusterSelectionMethod",
        type: "enum",
        default: "eom",
        options: ["eom", "leaf"],
        hint: "eom favours broader clusters; leaf favours smaller, tighter ones.",
      },
    ],
    exampleUseCase:
      "Surfaces multi-density fraud cohorts that a single-eps DBSCAN would split or merge.",
  },
  {
    id: "det.cluster.graph-community",
    name: "Graph-Based Community Detection",
    tab: "clustering",
    oneLine:
      "Builds a transaction / entity graph and detects communities to expose fraud networks.",
    complexity: "High",
    inputType: "Graph",
    outputType: "Labels",
    stability: "Beta",
    version: "v0.7",
    advantages: [
      "Surfaces synthetic-id and bust-out rings that share cards, devices, or addresses.",
      "Uses relational structure invisible to row-based models.",
      "Community membership is itself a strong, explainable feature for downstream scorers.",
    ],
    disadvantages: [
      "Requires constructing and maintaining a large entity graph.",
      "Community quality depends heavily on edge definition and resolution parameter.",
      "Harder to explain to a non-technical reviewer than a centroid cluster.",
    ],
    parameters: [
      {
        name: "resolution",
        type: "number",
        default: 1.0,
        min: 0.1,
        max: 5,
        step: 0.1,
        hint: "Lower values favour larger communities; higher values split them.",
      },
      {
        name: "algorithm",
        type: "enum",
        default: "louvain",
        options: ["louvain", "leiden", "label_propagation"],
        hint: "Community detection algorithm.",
      },
      {
        name: "edgeWeight",
        type: "enum",
        default: "shared_card",
        options: ["shared_card", "shared_device", "shared_address", "txn_amount"],
        hint: "How edge weight between entities is derived.",
      },
    ],
    exampleUseCase:
      "Reveals a 14-account bust-out ring sharing one device and a shipping address.",
  },
  {
    id: "det.cluster.kmeans",
    name: "KMeans (baseline)",
    tab: "clustering",
    oneLine:
      "Partitions transactions into k centroid-based clusters; used as a fast baseline.",
    complexity: "Low",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Stable",
    version: "v1.5",
    advantages: [
      "Very fast and simple — ideal baseline to compare richer clusterers against.",
      "Cluster distance doubles as a lightweight anomaly score.",
      "Deterministic given k and a fixed seed.",
    ],
    disadvantages: [
      "Requires presetting k, which is unknown for evolving fraud patterns.",
      "Assumes spherical, equal-sized clusters — misses elongated or nested rings.",
      "Sensitive to outliers; centroids drift toward extreme transactions.",
    ],
    parameters: [
      {
        name: "k",
        type: "integer",
        default: 8,
        min: 2,
        max: 100,
        step: 1,
        hint: "Number of clusters (centroids).",
      },
      {
        name: "init",
        type: "enum",
        default: "k-means++",
        options: ["k-means++", "random"],
        hint: "Centroid initialisation strategy.",
      },
      {
        name: "nInit",
        type: "integer",
        default: 10,
        min: 1,
        max: 50,
        step: 1,
        hint: "Number of restarts; higher reduces local minima.",
      },
      {
        name: "randomState",
        type: "integer",
        default: 42,
        min: 0,
        max: 999,
        step: 1,
        hint: "Seed for reproducibility.",
      },
    ],
    exampleUseCase:
      "Establishes a baseline behavioural segmentation before comparing HDBSCAN ring output.",
  },

  // ──────────────────────── ANOMALY DETECTION ────────────────────────────
  {
    id: "det.anomaly.isolation-forest",
    name: "Isolation Forest",
    tab: "anomaly-detection",
    oneLine:
      "Isolates anomalies via random partition trees; anomalies need fewer splits to separate.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.3",
    advantages: [
      "Fast and scales well to millions of transactions.",
      "No need for a clean 'normal' set — works unsupervised.",
      "Low memory footprint; easy to retrain on rolling windows.",
    ],
    disadvantages: [
      "Struggles with high-dimensional sparse fraud features (one-hot MCC, merchant ids).",
      "Random splits make scores jittery across retraining runs without a fixed seed.",
      "Less effective when fraud is dense enough to look 'normal'.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 100,
        min: 10,
        max: 1000,
        step: 10,
        hint: "Number of isolation trees in the forest.",
      },
      {
        name: "contamination",
        type: "number",
        default: 0.02,
        min: 0.001,
        max: 0.5,
        step: 0.001,
        hint: "Expected fraction of anomalies in the data.",
      },
      {
        name: "maxSamples",
        type: "enum",
        default: "auto",
        options: ["auto", "256", "512", "1024"],
        hint: "Subsample size drawn to train each tree.",
      },
    ],
    exampleUseCase:
      "Scores each transaction for isolation depth; the shallowest 2% are auto-flagged.",
  },
  {
    id: "det.anomaly.lof",
    name: "Local Outlier Factor (LOF)",
    tab: "anomaly-detection",
    oneLine:
      "Scores local density deviation; flags points much sparser than their neighbours.",
    complexity: "Medium",
    inputType: "Vector",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Detects local anomalies global methods miss — a small spend in a high-value cohort.",
      "No training phase; scores are computed at query time.",
      "Score magnitude is interpretable as a density ratio.",
    ],
    disadvantages: [
      "k-NN search is expensive on large or high-dimensional data.",
      "Sensitive to the choice of k and the distance metric.",
      "Degrades when density varies widely across the dataset.",
    ],
    parameters: [
      {
        name: "nNeighbors",
        type: "integer",
        default: 20,
        min: 2,
        max: 200,
        step: 1,
        hint: "Number of neighbours used for local density.",
      },
      {
        name: "contamination",
        type: "number",
        default: 0.02,
        min: 0.001,
        max: 0.5,
        step: 0.001,
        hint: "Expected fraction of anomalies.",
      },
      {
        name: "metric",
        type: "enum",
        default: "euclidean",
        options: ["euclidean", "manhattan", "minkowski"],
        hint: "Distance metric for neighbour search.",
      },
    ],
    exampleUseCase:
      "Catches a $200 test charge that is anomalous only within a high-spend cardholder's history.",
  },
  {
    id: "det.anomaly.autoencoder",
    name: "Autoencoder",
    tab: "anomaly-detection",
    oneLine:
      "Neural net trained to reconstruct normal data; high reconstruction error signals fraud.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Beta",
    version: "v0.9",
    advantages: [
      "Learns nonlinear normal-behaviour manifolds that linear models can't.",
      "Captures complex feature interactions without manual feature engineering.",
      "Reconstruction error per feature helps explain which signal drove the score.",
    ],
    disadvantages: [
      "Needs a clean-ish normal training set; fraud in training corrupts the model.",
      "Training cost and hyperparameter tuning are significant.",
      "Less explainable than tree or linear methods for audit purposes.",
    ],
    parameters: [
      {
        name: "encodingDim",
        type: "integer",
        default: 16,
        min: 2,
        max: 128,
        step: 1,
        hint: "Size of the latent bottleneck layer.",
      },
      {
        name: "epochs",
        type: "integer",
        default: 50,
        min: 1,
        max: 500,
        step: 1,
        hint: "Training epochs on the normal-only set.",
      },
      {
        name: "threshold",
        type: "number",
        default: 0.95,
        min: 0.5,
        max: 0.999,
        step: 0.001,
        hint: "Reconstruction-error percentile above which a row is flagged.",
      },
      {
        name: "activation",
        type: "enum",
        default: "relu",
        options: ["relu", "tanh", "sigmoid"],
        hint: "Hidden layer activation.",
      },
    ],
    exampleUseCase:
      "Reconstructs each transaction; the top 5% by error go to analyst review.",
  },
  {
    id: "det.anomaly.one-class-svm",
    name: "One-Class SVM",
    tab: "anomaly-detection",
    oneLine:
      "Learns a boundary around normal data in kernel space; points outside are anomalies.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Flexible nonlinear boundary via the kernel trick.",
      "Works in purely unsupervised settings with no labels.",
      "Decision distance to the boundary is a continuous, rankable score.",
    ],
    disadvantages: [
      "O(n^2) kernel computation scales poorly past tens of thousands of rows.",
      "Very sensitive to nu and gamma; small changes reshape the boundary.",
      "Kernel methods struggle with very high-dimensional sparse features.",
    ],
    parameters: [
      {
        name: "nu",
        type: "number",
        default: 0.05,
        min: 0.001,
        max: 0.5,
        step: 0.001,
        hint: "Upper bound on training errors and lower bound on support vectors.",
      },
      {
        name: "kernel",
        type: "enum",
        default: "rbf",
        options: ["rbf", "linear", "poly", "sigmoid"],
        hint: "Kernel function for the boundary.",
      },
      {
        name: "gamma",
        type: "enum",
        default: "scale",
        options: ["scale", "auto"],
        hint: "RBF / poly kernel coefficient.",
      },
    ],
    exampleUseCase:
      "Boundaries the normal spending region for a merchant portfolio; out-of-region txns are flagged.",
  },

  // ───────────────────────── CLASSIFICATION ─────────────────────────────
  {
    id: "det.class.xgboost",
    name: "XGBoost",
    tab: "classification",
    oneLine:
      "Gradient-boosted trees; strong, widely-used supervised fraud scorer.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.6",
    advantages: [
      "State-of-the-art accuracy on tabular fraud data.",
      "Handles missing values and mixed feature types natively.",
      "Feature-importance and SHAP outputs support model-agnostic explanation.",
    ],
    disadvantages: [
      "Many hyperparameters; easy to overfit the rare positive class.",
      "Class imbalance requires careful weighting or sampling.",
      "Slower to train than linear models; less trivial to retrain online.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 200,
        min: 10,
        max: 2000,
        step: 10,
        hint: "Number of boosting rounds.",
      },
      {
        name: "maxDepth",
        type: "integer",
        default: 6,
        min: 1,
        max: 20,
        step: 1,
        hint: "Maximum tree depth.",
      },
      {
        name: "learningRate",
        type: "number",
        default: 0.1,
        min: 0.001,
        max: 1,
        step: 0.001,
        hint: "Shrinkage applied to each tree.",
      },
      {
        name: "scalePosWeight",
        type: "number",
        default: 10,
        min: 1,
        max: 100,
        step: 1,
        hint: "Weight of the positive (fraud) class to counter imbalance.",
      },
    ],
    exampleUseCase:
      "Scores every transaction 0-1; above the threshold it routes to the review queue.",
  },
  {
    id: "det.class.lightgbm",
    name: "LightGBM",
    tab: "classification",
    oneLine:
      "Leaf-wise gradient boosting; faster and more memory-efficient than XGBoost on large data.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.4",
    advantages: [
      "Trains faster than XGBoost on large transaction volumes.",
      "Histogram-based splits use far less memory.",
      "Native categorical feature support avoids one-hot explosion.",
    ],
    disadvantages: [
      "Leaf-wise growth can overfit on small datasets.",
      "Sensitive to min_child_samples and num_leaves tuning.",
      "Less ubiquitous tooling than XGBoost in some compliance stacks.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 200,
        min: 10,
        max: 2000,
        step: 10,
        hint: "Number of boosting iterations.",
      },
      {
        name: "numLeaves",
        type: "integer",
        default: 31,
        min: 2,
        max: 256,
        step: 1,
        hint: "Maximum leaves per tree; controls complexity.",
      },
      {
        name: "learningRate",
        type: "number",
        default: 0.1,
        min: 0.001,
        max: 1,
        step: 0.001,
        hint: "Shrinkage per iteration.",
      },
      {
        name: "minChildSamples",
        type: "integer",
        default: 20,
        min: 1,
        max: 500,
        step: 1,
        hint: "Minimum data in a leaf; higher reduces overfit.",
      },
    ],
    exampleUseCase:
      "Scores 50M monthly transactions where XGBoost training time is prohibitive.",
  },
  {
    id: "det.class.logistic-regression",
    name: "Logistic Regression",
    tab: "classification",
    oneLine:
      "Linear fraud / not-fraud classifier; the explainable, audit-friendly baseline.",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.3",
    advantages: [
      "Highly explainable and audit-friendly for banking compliance.",
      "Fast to train and score; trivial to retrain on new data.",
      "Coefficients give direct feature contribution per decision.",
    ],
    disadvantages: [
      "Lower accuracy on nonlinear fraud patterns.",
      "Requires careful feature scaling and encoding.",
      "Cannot model interactions without manual feature crosses.",
    ],
    parameters: [
      {
        name: "penalty",
        type: "enum",
        default: "l2",
        options: ["l2", "l1", "elasticnet", "none"],
        hint: "Regularisation type.",
      },
      {
        name: "C",
        type: "number",
        default: 1.0,
        min: 0.001,
        max: 100,
        step: 0.001,
        hint: "Inverse regularisation strength; lower = stronger regularisation.",
      },
      {
        name: "classWeight",
        type: "enum",
        default: "balanced",
        options: ["balanced", "none"],
        hint: "Weighting for the imbalanced fraud class.",
      },
      {
        name: "maxIter",
        type: "integer",
        default: 200,
        min: 50,
        max: 5000,
        step: 50,
        hint: "Maximum optimisation iterations.",
      },
    ],
    exampleUseCase:
      "Provides the auditable baseline score that regulators compare the XGBoost model against.",
  },
  {
    id: "det.class.random-forest",
    name: "Random Forest",
    tab: "classification",
    oneLine:
      "Bagged decision trees; robust, low-tuning supervised scorer with good explainability.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.4",
    advantages: [
      "Robust to outliers and irrelevant features with minimal tuning.",
      "Provides feature importance and per-tree decision paths for audit.",
      "Parallelisable training across trees.",
    ],
    disadvantages: [
      "Larger model footprint and slower scoring than a single tree.",
      "Less accurate than gradient boosting on most fraud benchmarks.",
      "Can still overfit noisy or high-cardinality categorical features.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 150,
        min: 10,
        max: 1000,
        step: 10,
        hint: "Number of trees in the forest.",
      },
      {
        name: "maxDepth",
        type: "enum",
        default: "none",
        options: ["none", "10", "20", "30"],
        hint: "Maximum tree depth; 'none' grows fully.",
      },
      {
        name: "maxFeatures",
        type: "enum",
        default: "sqrt",
        options: ["sqrt", "log2", "0.3", "none"],
        hint: "Features considered per split.",
      },
      {
        name: "classWeight",
        type: "enum",
        default: "balanced_subsample",
        options: ["balanced", "balanced_subsample", "none"],
        hint: "Class weighting to counter imbalance.",
      },
    ],
    exampleUseCase:
      "A robust fallback scorer when the boosted model is being retrained or audited.",
  },
];

export const ALGORITHM_BY_ID: Record<string, AlgorithmDef> = ALGORITHMS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, AlgorithmDef>,
);

export function algorithmsForTab(tab: AlgorithmTab): AlgorithmDef[] {
  return ALGORITHMS.filter((a) => a.tab === tab);
}

/**
 * Map a palette node defType (e.g. "det.cluster.dbscan") to its algorithm
 * definition. For detection nodes the defType doubles as the algorithm id;
 * feature nodes also share ids with their algorithm entries.
 */
export function algorithmForDefType(defType: string): AlgorithmDef | undefined {
  return ALGORITHM_BY_ID[defType];
}

/**
 * Algorithms available for a given detection sub-type, used by the Properties
 * panel algorithm-choice dropdown when a detection node is dropped.
 */
export function algorithmsForDetectionSubType(
  subType: "clustering" | "anomaly" | "classification",
): AlgorithmDef[] {
  const tabMap: Record<typeof subType, AlgorithmTab> = {
    clustering: "clustering",
    anomaly: "anomaly-detection",
    classification: "classification",
  };
  return algorithmsForTab(tabMap[subType]);
}

/**
 * Build the default parameter values object for an algorithm, used to seed a
 * node's params when it is first instantiated.
 */
export function defaultParamsFor(algorithmId: string): Record<string, unknown> {
  const algo = ALGORITHM_BY_ID[algorithmId];
  if (!algo) return {};
  const out: Record<string, unknown> = {};
  for (const p of algo.parameters) {
    out[p.name] = p.default;
  }
  return out;
}
