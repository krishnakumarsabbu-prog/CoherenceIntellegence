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
    type: "input.markdown-rules",
    label: "Markdown Rules (.md)",
    category: "input",
    hint: "Rule & parameter mapping",
    defaultDescription:
      "Ingests structured business rules and parameter specifications from a Markdown file (.md).",
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

  // FEATURE ENGINEERING — high-level node point
  {
    type: "feat.engineering",
    label: "Feature Engineering",
    category: "feature",
    hint: "Signal & Feature Transformation",
    defaultDescription:
      "Derives feature signals, aggregations, or dimensionality reductions.",
  },

  // DETECTION — high-level node points (select model algorithm from dropdown)
  {
    type: "det.clustering",
    label: "Clustering",
    category: "detection",
    detectionSubType: "clustering",
    hint: "Group similar patterns & rings",
    defaultDescription:
      "Groups transactions into clusters to surface fraud rings and cohorts.",
  },
  {
    type: "det.anomaly",
    label: "Anomaly Detection",
    category: "detection",
    detectionSubType: "anomaly",
    hint: "Outlier & behavior scoring",
    defaultDescription:
      "Detects transactions that deviate significantly from baseline behavior.",
  },
  {
    type: "det.classification",
    label: "Classification",
    category: "detection",
    detectionSubType: "classification",
    hint: "Supervised fraud classifier",
    defaultDescription:
      "Classifies transactions as fraud or legitimate using trained models.",
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
