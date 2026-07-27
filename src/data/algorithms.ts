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
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  hint: string;
}

export interface AlgorithmDef {
  id: string;
  name: string;
  tab: AlgorithmTab;
  category?: string;
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
  // ───────────────────────── FEATURE ENGINEERING (10) ─────────────────────────
  {
    id: "feat.velocity-features",
    name: "Velocity Features",
    tab: "feature-engineering",
    category: "feature-engineering",
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
    category: "feature-engineering",
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
    category: "feature-engineering",
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
    category: "feature-engineering",
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
    category: "feature-engineering",
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
  {
    id: "feat.target-encoding",
    name: "Target Encoding",
    tab: "feature-engineering",
    category: "feature-engineering",
    oneLine:
      "Encodes high-cardinality categoricals using smoothed mean target fraud rates.",
    complexity: "Medium",
    inputType: "Tabular",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Replaces high-cardinality columns (e.g. zip codes, merchant IDs) with informative 1D floats.",
      "Uses Bayesian smoothing to prevent extreme estimates on rare categories.",
      "Dramatically speeds up tree and linear models without massive sparse matrices.",
    ],
    disadvantages: [
      "Prone to target leakage if not fitted strictly inside cross-validation splits.",
      "Requires historical label availability to compute credible target priors.",
    ],
    parameters: [
      {
        name: "smoothing",
        type: "number",
        default: 10.0,
        min: 1.0,
        max: 100.0,
        step: 1.0,
        hint: "Weight assigned to global mean relative to category mean.",
      },
      {
        name: "cvFolds",
        type: "integer",
        default: 5,
        min: 2,
        max: 10,
        step: 1,
        hint: "Out-of-fold splits for target encoding to prevent leakage.",
      },
    ],
    exampleUseCase:
      "Transforms 250,000 raw merchant IDs into smoothed historical fraud rate numbers.",
  },
  {
    id: "feat.polynomial-features",
    name: "Polynomial Features",
    tab: "feature-engineering",
    category: "feature-engineering",
    oneLine:
      "Generates feature cross-products and powers for capturing non-linear interactions.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Exposes multiplicative terms like (amount * velocity) to simple linear models.",
      "Deterministic and fast to evaluate during online scoring.",
    ],
    disadvantages: [
      "Causes explosive feature dimension growth (O(d^degree)).",
      "Creates collinearity that requires downstream regularisation.",
    ],
    parameters: [
      {
        name: "degree",
        type: "integer",
        default: 2,
        min: 2,
        max: 4,
        step: 1,
        hint: "Maximum polynomial degree.",
      },
      {
        name: "interactionOnly",
        type: "boolean",
        default: true,
        hint: "Produce interaction terms only (exclude self-powers).",
      },
    ],
    exampleUseCase:
      "Creates an explicit cross-feature between transaction distance and time of day.",
  },
  {
    id: "feat.tfidf-vectorizer",
    name: "TF-IDF Vectorizer",
    tab: "feature-engineering",
    category: "feature-engineering",
    oneLine:
      "Extracts term frequency-inverse document frequency features from transaction memos & titles.",
    complexity: "Medium",
    inputType: "Tabular",
    outputType: "Embedding",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Surfaces suspicious keyword combinations in wire transfer memo text.",
      "Downweights common noise words while emphasizing rare fraud indicators.",
    ],
    disadvantages: [
      "Does not capture semantic word order or deep contextual meaning.",
      "Generates sparse outputs that require linear or tree models suited for high-dimensionality.",
    ],
    parameters: [
      {
        name: "maxFeatures",
        type: "integer",
        default: 500,
        min: 50,
        max: 5000,
        step: 50,
        hint: "Maximum number of vocabulary terms to retain.",
      },
      {
        name: "ngramRange",
        type: "enum",
        default: "1-2",
        options: ["1-1", "1-2", "1-3"],
        hint: "N-gram word tuples to consider.",
      },
    ],
    exampleUseCase:
      "Converts wire payment descriptions into term weight vectors to flag crypto purchase scams.",
  },
  {
    id: "feat.frequency-encoding",
    name: "Frequency Encoding",
    tab: "feature-engineering",
    category: "feature-engineering",
    oneLine:
      "Maps categorical values to their normalized occurrence counts across the dataset.",
    complexity: "Low",
    inputType: "Tabular",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Completely unsupervised method suitable for live streaming feeds.",
      "Captures rarity of categorical attributes without risk of target leakage.",
    ],
    disadvantages: [
      "Categories with identical frequencies map to the exact same value.",
      "Does not inform the model whether a frequency is good or bad by itself.",
    ],
    parameters: [
      {
        name: "normalize",
        type: "boolean",
        default: true,
        hint: "Normalize raw counts to fractions of total rows.",
      },
    ],
    exampleUseCase:
      "Identifies rare IP subnets and device user-agents based on low dataset frequencies.",
  },
  {
    id: "feat.robust-scaler",
    name: "Robust Feature Scaler",
    tab: "feature-engineering",
    category: "feature-engineering",
    oneLine:
      "Scales numeric features using statistics robust to severe financial outliers (IQR/Median).",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Feature Set",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Prevents multi-million dollar wire outliers from crushing standard scaler variances.",
      "Centers data at median rather than mean, maintaining natural distributions.",
    ],
    disadvantages: [
      "Outliers remain un-bounded in scaled space (unlike MinMax scaling).",
    ],
    parameters: [
      {
        name: "quantileRange",
        type: "enum",
        default: "25-75",
        options: ["25-75", "10-90", "5-95"],
        hint: "Interquartile percentile range used for scaling.",
      },
    ],
    exampleUseCase:
      "Prepares highly skewed transaction amount distributions for neural network models.",
  },

  // ───────────────────────────── CLUSTERING (10) ──────────────────────────────
  {
    id: "det.cluster.dbscan",
    name: "DBSCAN",
    tab: "clustering",
    category: "clustering",
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
    category: "clustering",
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
    category: "clustering",
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
    category: "clustering",
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
  {
    id: "det.cluster.agglomerative",
    name: "Agglomerative Clustering",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Hierarchical bottom-up tree clustering that iteratively merges nearest clusters.",
    complexity: "Medium",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Builds a full dendrogram revealing hierarchical relationships among entity cohorts.",
      "Supports arbitrary distance metrics and linkage criteria.",
    ],
    disadvantages: [
      "O(n^3) time complexity makes raw scaling to massive transaction volumes slow.",
      "Once two items are merged early, the decision cannot be undone.",
    ],
    parameters: [
      {
        name: "nClusters",
        type: "integer",
        default: 5,
        min: 2,
        max: 50,
        step: 1,
        hint: "Number of clusters to find.",
      },
      {
        name: "linkage",
        type: "enum",
        default: "ward",
        options: ["ward", "complete", "average", "single"],
        hint: "Linkage criterion.",
      },
    ],
    exampleUseCase:
      "Hierarchy exploration of merchant spending behaviors across sub-industries.",
  },
  {
    id: "det.cluster.gmm",
    name: "Gaussian Mixture Models (GMM)",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Probabilistic soft clustering assigning probability distributions over component Gaussian distributions.",
    complexity: "High",
    inputType: "Vector",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.3",
    advantages: [
      "Provides soft cluster membership probabilities rather than strict hard labels.",
      "Allows elliptical clusters of varying shapes and orientations.",
    ],
    disadvantages: [
      "Sensitive to initial parameters; EM algorithm can get stuck in local optima.",
      "Requires specifying the number of components in advance.",
    ],
    parameters: [
      {
        name: "nComponents",
        type: "integer",
        default: 6,
        min: 2,
        max: 30,
        step: 1,
        hint: "Number of Gaussian components.",
      },
      {
        name: "covarianceType",
        type: "enum",
        default: "full",
        options: ["full", "tied", "diag", "spherical"],
        hint: "Type of covariance parameters.",
      },
    ],
    exampleUseCase:
      "Estimates posterior probability of a transaction belonging to legitimate high-value customer clusters.",
  },
  {
    id: "det.cluster.optics",
    name: "OPTICS",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Ordering points to identify cluster structure, handling multi-density spatial structures.",
    complexity: "High",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Beta",
    version: "v0.9",
    advantages: [
      "Does not require a strict global eps parameter like standard DBSCAN.",
      "Produces a reachability plot showing density levels across all scales.",
    ],
    disadvantages: [
      "Higher memory and execution time requirements than DBSCAN.",
    ],
    parameters: [
      {
        name: "minSamples",
        type: "integer",
        default: 5,
        min: 2,
        max: 50,
        step: 1,
        hint: "Number of samples in a neighborhood for a point to be a core point.",
      },
      {
        name: "maxEps",
        type: "number",
        default: 2.0,
        min: 0.1,
        max: 10.0,
        step: 0.1,
        hint: "Maximum distance between two samples.",
      },
    ],
    exampleUseCase:
      "Detects ATM cash-out clusters across urban centers with vastly different transaction densities.",
  },
  {
    id: "det.cluster.spectral",
    name: "Spectral Clustering",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Uses spectrum of graph Laplacian matrix to perform non-linear manifold clustering.",
    complexity: "High",
    inputType: "Graph",
    outputType: "Labels",
    stability: "Beta",
    version: "v1.0",
    advantages: [
      "Discovers highly complex non-convex cluster shapes in graph embedding space.",
      "Effective for network graph connectivity clustering.",
    ],
    disadvantages: [
      "Eigen-decomposition of similarity matrix is computationally expensive for n > 20,000.",
    ],
    parameters: [
      {
        name: "nClusters",
        type: "integer",
        default: 8,
        min: 2,
        max: 50,
        step: 1,
        hint: "Number of clusters to extract.",
      },
      {
        name: "affinity",
        type: "enum",
        default: "rbf",
        options: ["rbf", "nearest_neighbors"],
        hint: "Affinity matrix construction method.",
      },
    ],
    exampleUseCase:
      "Groups interconnected device fingerprint networks to unearth coordinated bot farms.",
  },
  {
    id: "det.cluster.bisecting-kmeans",
    name: "Bisecting KMeans",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Hierarchical divisive algorithm splitting clusters using fast repeated k=2 KMeans.",
    complexity: "Low",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Faster and more consistent than standard KMeans on large datasets.",
      "Produces a structured cluster hierarchy while remaining computationally cheap.",
    ],
    disadvantages: [
      "Still constrained by spherical cluster geometry assumptions.",
    ],
    parameters: [
      {
        name: "nClusters",
        type: "integer",
        default: 10,
        min: 2,
        max: 100,
        step: 1,
        hint: "Total number of leaf clusters.",
      },
      {
        name: "bisectingStrategy",
        type: "enum",
        default: "biggest_cluster",
        options: ["biggest_cluster", "largest_sse"],
        hint: "Which cluster to split next.",
      },
    ],
    exampleUseCase:
      "Fast segmentation of customer transaction profiles for real-time risk tiers.",
  },
  {
    id: "det.cluster.mean-shift",
    name: "Mean Shift",
    tab: "clustering",
    category: "clustering",
    oneLine:
      "Non-parametric mode-seeking algorithm discovering cluster centers by updating candidate points.",
    complexity: "High",
    inputType: "Vector",
    outputType: "Labels",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Does not require specifying number of clusters in advance.",
      "Finds arbitrary mode centers determined purely by data density.",
    ],
    disadvantages: [
      "Bandwidth parameter selection heavily impacts output cluster quality.",
      "Computationally intensive on high-dimensional vectors.",
    ],
    parameters: [
      {
        name: "bandwidth",
        type: "number",
        default: 1.5,
        min: 0.1,
        max: 10.0,
        step: 0.1,
        hint: "Kernel bandwidth parameter.",
      },
      {
        name: "binSeeding",
        type: "boolean",
        default: true,
        hint: "Discretize initial seeds to accelerate convergence.",
      },
    ],
    exampleUseCase:
      "Locates geographical hotspots of compromised POS terminal swipe locations.",
  },

  // ──────────────────────── ANOMALY DETECTION (10) ────────────────────────────
  {
    id: "det.anomaly.isolation-forest",
    name: "Isolation Forest",
    tab: "anomaly-detection",
    category: "anomaly-detection",
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
    category: "anomaly-detection",
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
    category: "anomaly-detection",
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
    category: "anomaly-detection",
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
  {
    id: "det.anomaly.elliptic-envelope",
    name: "Elliptic Envelope (MCD)",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Fits a robust covariance envelope assuming Gaussian-distributed legitimate transaction features.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Extremely fast calculation for continuous feature matrices.",
      "Robust against extreme outliers due to Minimum Covariance Determinant fitting.",
    ],
    disadvantages: [
      "Assumes features follow unimodal Gaussian distributions; fails on multi-modal data.",
    ],
    parameters: [
      {
        name: "contamination",
        type: "number",
        default: 0.03,
        min: 0.001,
        max: 0.2,
        step: 0.001,
        hint: "Expected proportion of outliers.",
      },
      {
        name: "assumeCentered",
        type: "boolean",
        default: false,
        hint: "Assume data is pre-centered around origin.",
      },
    ],
    exampleUseCase:
      "Detects anomalous transfer amounts and frequencies in standardized corporate payroll runs.",
  },
  {
    id: "det.anomaly.copod",
    name: "COPOD (Copula Outlier Detection)",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Fast parameter-free anomaly detector estimating empirical copula tail probabilities.",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Parameter-free: zero hyperparameter tuning required.",
      "Linear time complexity O(d*n) makes it among the fastest anomaly detectors available.",
      "Highly interpretable dimensional contribution breakdown per outlier.",
    ],
    disadvantages: [
      "Assumes tail independence across features.",
    ],
    parameters: [
      {
        name: "contamination",
        type: "number",
        default: 0.02,
        min: 0.001,
        max: 0.5,
        step: 0.001,
        hint: "Expected anomaly ratio.",
      },
    ],
    exampleUseCase:
      "Real-time streaming evaluation of high-throughput payment gateway transactions.",
  },
  {
    id: "det.anomaly.hbos",
    name: "HBOS (Histogram-Based Score)",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Calculates outlier scores by constructing independent static/dynamic feature histograms.",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Orders of magnitude faster than distance or tree-based algorithms.",
      "Ideal for ultra-high speed streaming fraud filtering.",
    ],
    disadvantages: [
      "Ignores feature correlations completely due to independence assumption.",
    ],
    parameters: [
      {
        name: "nBins",
        type: "integer",
        default: 20,
        min: 5,
        max: 100,
        step: 5,
        hint: "Number of histogram bins per feature.",
      },
      {
        name: "alpha",
        type: "number",
        default: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        hint: "Regularizer for bin width.",
      },
    ],
    exampleUseCase:
      "First-pass rapid filter dropping 90% of clearly normal transactions in milliseconds.",
  },
  {
    id: "det.anomaly.pca-anomaly",
    name: "PCA Outlier Detection",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Measures projection distance of data points onto low-variance principal component directions.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Detects structural covariance breakdown in complex multi-variate transactions.",
      "Simple, well-understood mathematical foundation.",
    ],
    disadvantages: [
      "Sensitive to non-linear correlations.",
    ],
    parameters: [
      {
        name: "nComponents",
        type: "integer",
        default: 5,
        min: 1,
        max: 20,
        step: 1,
        hint: "Number of eigenvectors kept.",
      },
    ],
    exampleUseCase:
      "Flags institutional wire transfers with unusual combinations of currency swap parameters.",
  },
  {
    id: "det.anomaly.knn-outlier",
    name: "k-NN Outlier Score",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Uses distance to the k-th nearest neighbor as a direct anomaly score.",
    complexity: "Medium",
    inputType: "Vector",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Intuitive concept: isolated points far from all neighbors receive high scores.",
      "No training step required.",
    ],
    disadvantages: [
      "Distance matrix computation scales quadratic with transaction volume.",
    ],
    parameters: [
      {
        name: "k",
        type: "integer",
        default: 10,
        min: 1,
        max: 100,
        step: 1,
        hint: "k-th neighbor distance to measure.",
      },
      {
        name: "method",
        type: "enum",
        default: "mean",
        options: ["mean", "median", "largest"],
        hint: "Score calculation metric.",
      },
    ],
    exampleUseCase:
      "Pinpoints rogue online credit applications placed from isolated geographical coordinates.",
  },
  {
    id: "det.anomaly.deep-svdd",
    name: "Deep SVDD",
    tab: "anomaly-detection",
    category: "anomaly-detection",
    oneLine:
      "Neural network mapping normal data into a minimal volume hypersphere centered in latent space.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Beta",
    version: "v0.8",
    advantages: [
      "Jointly learns feature representations and anomaly detection hypersphere boundary.",
      "Handles high-dimensional image, voice, or text payload features.",
    ],
    disadvantages: [
      "Subject to hypersphere collapse if weights or biases are improperly initialized.",
    ],
    parameters: [
      {
        name: "nu",
        type: "number",
        default: 0.05,
        min: 0.001,
        max: 0.2,
        step: 0.001,
        hint: "Outlier fraction bound.",
      },
      {
        name: "networkArchitecture",
        type: "enum",
        default: "dense-3layer",
        options: ["dense-3layer", "dense-5layer"],
        hint: "Neural architecture.",
      },
    ],
    exampleUseCase:
      "Detects subtle synthetic identity fraud embedded in complex biometric & behavioral vectors.",
  },

  // ───────────────────────── CLASSIFICATION (10) ───────────────────────────
  {
    id: "det.class.xgboost",
    name: "XGBoost",
    tab: "classification",
    category: "classification",
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
    category: "classification",
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
    category: "classification",
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
    category: "classification",
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
  {
    id: "det.class.catboost",
    name: "CatBoost Classifier",
    tab: "classification",
    category: "classification",
    oneLine:
      "Symmetric gradient boosting with native target statistics handling categorical fraud data.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Best-in-class performance on datasets containing raw un-encoded categoricals.",
      "Reduces overfitting risk through ordered boosting techniques.",
      "Provides ultra-fast GPU scoring latency.",
    ],
    disadvantages: [
      "Training can be memory-intensive on large parameter search grids.",
    ],
    parameters: [
      {
        name: "iterations",
        type: "integer",
        default: 500,
        min: 50,
        max: 2000,
        step: 50,
        hint: "Number of tree building iterations.",
      },
      {
        name: "depth",
        type: "integer",
        default: 6,
        min: 2,
        max: 12,
        step: 1,
        hint: "Depth of symmetric trees.",
      },
      {
        name: "learningRate",
        type: "number",
        default: 0.05,
        min: 0.001,
        max: 0.5,
        step: 0.005,
        hint: "Shrinkage rate.",
      },
    ],
    exampleUseCase:
      "Directly ingests raw merchant, device, and card bin categoricals to predict fraud.",
  },
  {
    id: "det.class.svc",
    name: "Support Vector Classifier (SVC)",
    tab: "classification",
    category: "classification",
    oneLine:
      "Supervised max-margin classifier mapping decision boundaries in high-dimensional kernel space.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.1",
    advantages: [
      "Effective in high-dimensional spaces where feature count exceeds sample count.",
      "Versatile choice of kernel functions (RBF, Polynomial, Sigmoid).",
    ],
    disadvantages: [
      "Does not directly provide probability estimates (requires Platt scaling).",
      "Slow to train on datasets larger than 50,000 samples.",
    ],
    parameters: [
      {
        name: "C",
        type: "number",
        default: 1.0,
        min: 0.1,
        max: 50.0,
        step: 0.5,
        hint: "Regularization parameter.",
      },
      {
        name: "kernel",
        type: "enum",
        default: "rbf",
        options: ["rbf", "linear", "poly"],
        hint: "Kernel type.",
      },
    ],
    exampleUseCase:
      "Classifies high-risk account takeover attempts based on behavioral telemetry vectors.",
  },
  {
    id: "det.class.naive-bayes",
    name: "Naive Bayes Classifier",
    tab: "classification",
    category: "classification",
    oneLine:
      "Fast probabilistic classifier applying Bayes theorem under strong feature independence assumptions.",
    complexity: "Low",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.0",
    advantages: [
      "Extremely fast to train and predict in real-time online setups.",
      "Requires small training data volumes to estimate parameters.",
    ],
    disadvantages: [
      "Assumes feature independence, which rarely holds true in financial transaction logs.",
    ],
    parameters: [
      {
        name: "varSmoothing",
        type: "number",
        default: 1e-9,
        min: 1e-11,
        max: 1e-5,
        step: 1e-10,
        hint: "Portion of largest variance added to variances for stability.",
      },
    ],
    exampleUseCase:
      "Generates initial baseline probability scores for email & domain fraud signals.",
  },
  {
    id: "det.class.extra-trees",
    name: "Extra Trees Classifier",
    tab: "classification",
    category: "classification",
    oneLine:
      "Extremely randomized ensemble trees offering faster computation and reduced variance.",
    complexity: "Medium",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.2",
    advantages: [
      "Randomizes cut points for each feature, reducing variance compared to standard Random Forest.",
      "Faster computation speed due to random split node evaluation.",
    ],
    disadvantages: [
      "Slightly higher bias than standard Random Forest.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 100,
        min: 10,
        max: 1000,
        step: 10,
        hint: "Number of trees.",
      },
      {
        name: "criterion",
        type: "enum",
        default: "gini",
        options: ["gini", "entropy", "log_loss"],
        hint: "Split quality criterion.",
      },
    ],
    exampleUseCase:
      "Fast ensemble scoring over dense feature sets to detect authorization fraud.",
  },
  {
    id: "det.class.mlp",
    name: "Multi-Layer Perceptron (MLP)",
    tab: "classification",
    category: "classification",
    oneLine:
      "Deep feed-forward artificial neural network learning non-linear feature maps for fraud.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Beta",
    version: "v1.0",
    advantages: [
      "Capable of learning highly complex non-linear decision boundaries.",
      "Scales well when paired with deep learning GPU acceleration frameworks.",
    ],
    disadvantages: [
      "Black-box nature requires secondary XAI tools (SHAP/LIME) for regulatory audits.",
    ],
    parameters: [
      {
        name: "hiddenLayerSizes",
        type: "enum",
        default: "(100,50)",
        options: ["(100,50)", "(64,32,16)", "(128,64)"],
        hint: "Architecture of hidden layers.",
      },
      {
        name: "alpha",
        type: "number",
        default: 0.0001,
        min: 0.00001,
        max: 0.01,
        step: 0.0001,
        hint: "L2 penalty hyperparameter.",
      },
    ],
    exampleUseCase:
      "Learns multi-layered fraud patterns across cross-border payment networks.",
  },
  {
    id: "det.class.gradient-boosting",
    name: "Gradient Boosting Classifier",
    tab: "classification",
    category: "classification",
    oneLine:
      "Classic stage-wise additive model building decision trees on loss function residual gradients.",
    complexity: "High",
    inputType: "Feature Set",
    outputType: "Scores",
    stability: "Stable",
    version: "v1.3",
    advantages: [
      "High predictive accuracy and strong performance out of the box.",
      "Supports custom loss functions tailored for asymmetric fraud costs.",
    ],
    disadvantages: [
      "Sequential tree training cannot be easily parallelized like Random Forest.",
    ],
    parameters: [
      {
        name: "nEstimators",
        type: "integer",
        default: 100,
        min: 10,
        max: 500,
        step: 10,
        hint: "Boosting stages.",
      },
      {
        name: "subsample",
        type: "number",
        default: 0.8,
        min: 0.5,
        max: 1.0,
        step: 0.05,
        hint: "Fraction of samples used for fitting individual base learners.",
      },
    ],
    exampleUseCase:
      "Produces loss-minimizing risk scores for high-value wire transfers.",
  },
];
