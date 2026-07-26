import type { CategoryMeta, NodeCategory, PaletteNodeDef } from "./types";

export const CATEGORY_ORDER: NodeCategory[] = [
  "input",
  "preprocessing",
  "feature",
  "detection",
  "output",
];

export const CATEGORY_META: Record<NodeCategory, CategoryMeta> = {
  input: {
    id: "input",
    label: "Input",
    text: "text-accent-600",
    tint: "bg-accent-50",
    accent: "#2E5AAC",
    soft: "#EEF3FB",
  },
  preprocessing: {
    id: "preprocessing",
    label: "Preprocessing",
    text: "text-teal-600",
    tint: "bg-teal-50",
    accent: "#0D9488",
    soft: "#F0FDFA",
  },
  feature: {
    id: "feature",
    label: "Feature Engineering",
    text: "text-violet-600",
    tint: "bg-violet-50",
    accent: "#7C3AED",
    soft: "#F5F3FF",
  },
  detection: {
    id: "detection",
    label: "Detection",
    text: "text-amber-600",
    tint: "bg-amber-50",
    accent: "#D97706",
    soft: "#FFFBEB",
  },
  output: {
    id: "output",
    label: "Output",
    text: "text-rose-600",
    tint: "bg-rose-50",
    accent: "#E11D48",
    soft: "#FFF1F2",
  },
};

export const DETECTION_SUBTYPE_LABELS: Record<string, string> = {
  clustering: "Clustering",
  anomaly: "Anomaly Detection",
  classification: "Classification",
};

/**
 * The fixed palette of node templates the analyst drags onto the canvas.
 * Detection nodes are stubbed generically here — real algorithm parameter
 * forms arrive in Phase 3.
 */
export const NODE_CATALOG: PaletteNodeDef[] = [
  // INPUT
  {
    type: "input.transaction-feed",
    label: "Transaction Feed",
    category: "input",
    hint: "Live transaction stream",
    defaultDescription: "Streams incoming transactions in real time.",
  },
  {
    type: "input.csv-upload",
    label: "CSV Upload",
    category: "input",
    hint: "Batch file ingestion",
    defaultDescription: "Ingests a CSV file of historical transactions.",
  },
  {
    type: "input.rest-api",
    label: "REST API",
    category: "input",
    hint: "Pull-based endpoint",
    defaultDescription: "Pulls transactions from a REST endpoint.",
  },
  {
    type: "input.kafka-stream",
    label: "Kafka Stream",
    category: "input",
    hint: "Pub/sub topic",
    defaultDescription: "Consumes transactions from a Kafka topic.",
  },

  // PREPROCESSING
  {
    type: "pre.cleaning",
    label: "Cleaning",
    category: "preprocessing",
    hint: "Remove bad records",
    defaultDescription: "Cleans raw records (trimming, type coercion).",
  },
  {
    type: "pre.missing-values",
    label: "Missing Values",
    category: "preprocessing",
    hint: "Impute or drop",
    defaultDescription: "Handles missing fields via imputation or dropping.",
  },
  {
    type: "pre.normalization",
    label: "Normalization",
    category: "preprocessing",
    hint: "Scale features",
    defaultDescription: "Scales numeric features to a common range.",
  },
  {
    type: "pre.deduplication",
    label: "Deduplication",
    category: "preprocessing",
    hint: "Drop duplicates",
    defaultDescription: "Removes duplicate transactions.",
  },

  // FEATURE ENGINEERING — defType matches algorithm id in /src/data/algorithms.ts
  {
    type: "feat.velocity-features",
    label: "Velocity Features",
    category: "feature",
    hint: "Rate-of-change signals",
    defaultDescription: "Derives velocity / rate-of-change features.",
  },
  {
    type: "feat.aggregation-window",
    label: "Aggregation Window",
    category: "feature",
    hint: "Time-windowed aggregates",
    defaultDescription: "Aggregates values over a rolling time window.",
  },
  {
    type: "feat.mutual-information-selection",
    label: "Mutual Information Selection",
    category: "feature",
    hint: "Rank features by MI",
    defaultDescription:
      "Ranks features by mutual information with the fraud label.",
  },
  {
    type: "feat.pca",
    label: "PCA",
    category: "feature",
    hint: "Dimensionality reduction",
    defaultDescription: "Reduces dimensionality via principal components.",
  },
  {
    type: "feat.chi-square-selection",
    label: "Chi-Square Selection",
    category: "feature",
    hint: "Categorical feature selection",
    defaultDescription:
      "Selects categorical features by chi-square independence with the label.",
  },

  // DETECTION — defType matches algorithm id in /src/data/algorithms.ts
  {
    type: "det.cluster.dbscan",
    label: "DBSCAN",
    category: "detection",
    detectionSubType: "clustering",
    hint: "Density clustering",
    defaultDescription: "Density-based clustering for outlier discovery.",
  },
  {
    type: "det.cluster.hdbscan",
    label: "HDBSCAN",
    category: "detection",
    detectionSubType: "clustering",
    hint: "Variable-density clustering",
    defaultDescription:
      "Hierarchical density clustering across varying densities.",
  },
  {
    type: "det.cluster.graph-community",
    label: "Graph-Based Community Detection",
    category: "detection",
    detectionSubType: "clustering",
    hint: "Network / ring detection",
    defaultDescription:
      "Detects communities in an entity graph to expose fraud rings.",
  },
  {
    type: "det.cluster.kmeans",
    label: "KMeans (baseline)",
    category: "detection",
    detectionSubType: "clustering",
    hint: "Centroid clustering baseline",
    defaultDescription: "Groups transactions into k centroid-based clusters.",
  },
  {
    type: "det.anomaly.isolation-forest",
    label: "Isolation Forest",
    category: "detection",
    detectionSubType: "anomaly",
    hint: "Tree-based anomaly",
    defaultDescription: "Isolates anomalies via random partition trees.",
  },
  {
    type: "det.anomaly.lof",
    label: "Local Outlier Factor (LOF)",
    category: "detection",
    detectionSubType: "anomaly",
    hint: "Density-based anomaly",
    defaultDescription: "Scores local density deviation as anomalies.",
  },
  {
    type: "det.anomaly.autoencoder",
    label: "Autoencoder",
    category: "detection",
    detectionSubType: "anomaly",
    hint: "Reconstruction error",
    defaultDescription: "Neural reconstruction-error anomaly scorer.",
  },
  {
    type: "det.anomaly.one-class-svm",
    label: "One-Class SVM",
    category: "detection",
    detectionSubType: "anomaly",
    hint: "Kernel boundary anomaly",
    defaultDescription:
      "Learns a boundary around normal data; points outside are anomalies.",
  },
  {
    type: "det.class.xgboost",
    label: "XGBoost",
    category: "detection",
    detectionSubType: "classification",
    hint: "Gradient-boosted trees",
    defaultDescription: "Gradient-boosted tree fraud classifier.",
  },
  {
    type: "det.class.lightgbm",
    label: "LightGBM",
    category: "detection",
    detectionSubType: "classification",
    hint: "Leaf-wise boosting",
    defaultDescription:
      "Leaf-wise gradient boosting; faster than XGBoost on large data.",
  },
  {
    type: "det.class.logistic-regression",
    label: "Logistic Regression",
    category: "detection",
    detectionSubType: "classification",
    hint: "Explainable baseline",
    defaultDescription: "Linear fraud / not-fraud classifier (audit-friendly).",
  },
  {
    type: "det.class.random-forest",
    label: "Random Forest",
    category: "detection",
    detectionSubType: "classification",
    hint: "Bagged trees",
    defaultDescription: "Bagged decision-tree fraud classifier.",
  },

  // OUTPUT
  {
    type: "out.flag-review",
    label: "Flag for Review",
    category: "output",
    hint: "Queue for analyst",
    defaultDescription: "Flags transactions for manual analyst review.",
  },
  {
    type: "out.auto-block",
    label: "Auto-Block",
    category: "output",
    hint: "Block immediately",
    defaultDescription: "Automatically blocks flagged transactions.",
  },
  {
    type: "out.webhook-alert",
    label: "Webhook Alert",
    category: "output",
    hint: "POST to endpoint",
    defaultDescription: "Sends a webhook alert for flagged transactions.",
  },
  {
    type: "out.case-export",
    label: "Case Management Export",
    category: "output",
    hint: "Export to case system",
    defaultDescription: "Exports flagged cases to the case management system.",
  },
];

export const NODE_DEF_BY_TYPE: Record<string, PaletteNodeDef> =
  NODE_CATALOG.reduce(
    (acc, def) => {
      acc[def.type] = def;
      return acc;
    },
    {} as Record<string, PaletteNodeDef>,
  );
