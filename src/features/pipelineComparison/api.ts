/** API client for the Pipeline Comparison + recommendation endpoints. */
import type { ComparisonResult, ExecutionSummary, Suggestion } from "./types";
import type { SavedPipelineShape } from "../executionConsole/types";

const API_BASE = "/api";

export async function runComparison(
  pipelines: SavedPipelineShape[],
  datasetRef: string | null,
): Promise<{ results: ComparisonResult[] }> {
  const res = await fetch(`${API_BASE}/pipelines/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipelines, dataset_ref: datasetRef }),
  });
  if (!res.ok) throw new Error(`Comparison failed (${res.status})`);
  return res.json();
}

export async function fetchRecommendations(
  pipeline: SavedPipelineShape,
  summary: ExecutionSummary,
): Promise<{ suggestions: Suggestion[] }> {
  const res = await fetch(`${API_BASE}/pipelines/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline, summary }),
  });
  if (!res.ok) throw new Error(`Recommendations failed (${res.status})`);
  return res.json();
}
