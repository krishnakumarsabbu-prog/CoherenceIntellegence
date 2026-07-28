/** Shared types for the Pipeline Comparison feature (Phase 5). */

export interface ComparisonResult {
  pipeline_id: string;
  pipeline_name: string;
  summary: ExecutionSummary | null;
  results: FullResults | null;
  error: string | null;
}

export interface ExecutionSummary {
  total_transactions: number;
  total_records_scored?: number;
  flagged: number;
  fraud_flagged_count?: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  execution_time_seconds?: number;
}

export interface ScoreBucket {
  bucket: string;
  count: number;
}

export interface FlaggedOverTimePoint {
  t: number;
  flagged: number;
}

export interface FlaggedRow {
  transaction_id: string;
  score: number;
  flagged: "Y" | "N";
  flagged_by: string;
  amount: number;
  country: string;
  is_fraud: boolean;
  tx_freq_1h?: number;
  geo_velocity?: number;
  device_risk_score?: number;
  fraud_reason?: string;
  risk_tier?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface FullResults {
  summary: ExecutionSummary;
  score_distribution: ScoreBucket[];
  flagged_over_time: FlaggedOverTimePoint[];
  flagged_rows: FlaggedRow[];
  detection_nodes: { id: string; label: string; algorithm: string | null }[];
  node_telemetry?: Record<string, any>;
  artifacts?: string[];
  artifacts_count?: number;
}

/** A suggestion from the rule-based recommendation engine. */
export interface Suggestion {
  id: string;
  title: string;
  why: string;
  estimate: {
    metric: string;
    delta: string;
    note: string;
  };
}

/** Artifact info returned by the streaming endpoint. */
export interface ArtifactInfo {
  name: string;
  path: string;
  size_bytes: number;
  modified: number;
  pipeline_id: string;
}

/** Per-pipeline live progress tracked by the comparison store. */
export interface PipelineProgress {
  pipeline_id: string;
  pipeline_name: string;
  index: number;
  status: "pending" | "running" | "complete" | "failed";
  nodes: { id: string; label: string; status: "pending" | "running" | "complete"; category: string }[];
  logs: { id: string; ts: string; level: "info" | "error"; message: string; node_id: string | null }[];
  artifacts: ArtifactInfo[];
  joblib_count: number;
  rule_count: number;
  total_artifacts: number;
  summary: ExecutionSummary | null;
  results: FullResults | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** Streaming event types from /pipelines/compare-stream. */
export type ComparisonEvent =
  | { type: "pipeline_start"; pipeline_id: string; pipeline_name: string; index: number; total: number; message: string; timestamp: string }
  | { type: "artifact_load"; pipeline_id: string; pipeline_name: string; index: number; artifacts: ArtifactInfo[]; joblib_files: ArtifactInfo[]; rule_files: ArtifactInfo[]; joblib_count: number; rule_count: number; total_artifacts: number; message: string; timestamp: string }
  | { type: "node"; pipeline_id: string; pipeline_name: string; index: number; node_id: string; node_label: string; node_status: "running" | "complete"; category: string; message: string; timestamp: string }
  | { type: "log"; pipeline_id: string; pipeline_name: string; index: number; level: "info" | "error"; message: string; node_id: string | null; node_status: string | null; timestamp: string }
  | { type: "pipeline_complete"; pipeline_id: string; pipeline_name: string; index: number; summary: ExecutionSummary | null; error: string | null; message: string; timestamp: string }
  | { type: "comparison_complete"; results: ComparisonResult[]; timestamp: string };
