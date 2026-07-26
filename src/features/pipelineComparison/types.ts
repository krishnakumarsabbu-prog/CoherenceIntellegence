/** Shared types for the Pipeline Comparison feature (Phase 5). */

export interface ComparisonResult {
  pipeline_id: string;
  pipeline_name: string;
  summary: ExecutionSummary | null;
  error: string | null;
}

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
