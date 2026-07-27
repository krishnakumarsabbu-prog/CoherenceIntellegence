/**
 * Shared types for the Execution Console (Phase 4).
 * Mirrors the FastAPI backend payloads in /backend/app/main.py.
 */

export interface ExecutionSummary {
  total_transactions: number;
  flagged: number;
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

export interface RuleClusterMapping {
  rule_id: string;
  cluster_id: number;
  cluster_label: string;
  rule_description: string;
  parameter_count: number;
  parameters: string;
  risk_level: string;
}

export interface ExecutionResults {
  summary: ExecutionSummary;
  score_distribution: ScoreBucket[];
  flagged_over_time: FlaggedOverTimePoint[];
  flagged_rows: FlaggedRow[];
  detection_nodes: { id: string; label: string; algorithm: string | null }[];
  rule_clusters?: RuleClusterMapping[];
  node_telemetry?: Record<string, any>;
}

export interface ExecutionRecord {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  summary: ExecutionSummary | null;
  results?: ExecutionResults;
  pipeline?: SavedPipelineShape;
}

export interface SavedPipelineShape {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
}

/** A single message off the execution WebSocket stream. */
export type WsMessage =
  | {
      type: "node";
      node_id: string;
      node_label: string;
      node_status: "running" | "complete";
      category: string;
      message: string;
      timestamp: string;
    }
  | {
      type: "log";
      level: "info" | "error";
      message: string;
      node_id: string | null;
      node_status: string | null;
      timestamp: string;
    }
  | { type: "complete"; message: string; results: ExecutionResults; timestamp: string }
  | { type: "error"; message: string; timestamp: string };

export interface DatasetInfo {
  id: string;
  name: string;
  source: string;
  row_count: number;
}
