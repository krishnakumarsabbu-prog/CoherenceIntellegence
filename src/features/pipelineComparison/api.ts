/** API client for the Pipeline Comparison streaming + recommendation endpoints. */
import type { SavedPipelineShape } from "../executionConsole/types";
import type { ComparisonResult, ComparisonEvent, ExecutionSummary, Suggestion } from "./types";

export type { Suggestion };

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

/**
 * Open a streaming NDJSON connection to /pipelines/compare-stream.
 * Calls onEvent for each parsed event. Returns a close() function.
 */
export function openComparisonStream(
  pipelines: SavedPipelineShape[],
  datasetRef: string | null,
  onEvent: (event: ComparisonEvent) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/pipelines/compare-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelines, dataset_ref: datasetRef }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        onError(new Error(`Comparison stream failed (${res.status})`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            onEvent(JSON.parse(trimmed) as ComparisonEvent);
          } catch {
            /* skip malformed line */
          }
        }
      }
      if (buffer.trim()) {
        try {
          onEvent(JSON.parse(buffer.trim()) as ComparisonEvent);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  })();

  return () => controller.abort();
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
