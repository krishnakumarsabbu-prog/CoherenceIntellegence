/**
 * Zustand store that orchestrates a streaming multi-pipeline comparison:
 * opens an NDJSON stream to /pipelines/compare-stream, tracks per-pipeline
 * progress (nodes, logs, artifacts), and exposes final results.
 */
import { create } from "zustand";
import { openComparisonStream } from "./api";
import type { SavedPipelineShape } from "../executionConsole/types";
import type {
  ComparisonResult,
  PipelineProgress,
  ComparisonEvent,
  ExecutionSummary,
  FullResults,
} from "./types";

export type ComparisonStatus = "idle" | "running" | "completed" | "failed";

interface ComparisonState {
  status: ComparisonStatus;
  progress: Record<string, PipelineProgress>;
  results: ComparisonResult[] | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  closeStream: (() => void) | null;

  run: (pipelines: SavedPipelineShape[], datasetRef: string | null) => Promise<void>;
  reset: () => void;
}

let logSeq = 0;
function nextLogId() {
  logSeq += 1;
  return `cmplog_${Date.now().toString(36)}_${logSeq}`;
}

function emptyProgress(pipeline_id: string, pipeline_name: string, index: number): PipelineProgress {
  return {
    pipeline_id,
    pipeline_name,
    index,
    status: "pending",
    nodes: [],
    logs: [],
    artifacts: [],
    joblib_count: 0,
    rule_count: 0,
    total_artifacts: 0,
    summary: null,
    results: null,
    error: null,
    startedAt: null,
    completedAt: null,
  };
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  status: "idle",
  progress: {},
  results: null,
  error: null,
  startedAt: null,
  completedAt: null,
  closeStream: null,

  run: async (pipelines, datasetRef) => {
    get().closeStream?.();
    const initial: Record<string, PipelineProgress> = {};
    pipelines.forEach((p, i) => {
      initial[p.id] = emptyProgress(p.id, p.name, i);
    });
    set({
      status: "running",
      progress: initial,
      results: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      closeStream: null,
    });

    const close = openComparisonStream(
      pipelines,
      datasetRef,
      (event: ComparisonEvent) => {
        if (event.type === "pipeline_start") {
          set((s) => ({
            progress: {
              ...s.progress,
              [event.pipeline_id]: {
                ...s.progress[event.pipeline_id],
                status: "running",
                startedAt: event.timestamp,
                logs: [
                  ...s.progress[event.pipeline_id].logs,
                  { id: nextLogId(), ts: event.timestamp, level: "info", message: event.message, node_id: null },
                ],
              },
            },
          }));
        } else if (event.type === "artifact_load") {
          set((s) => ({
            progress: {
              ...s.progress,
              [event.pipeline_id]: {
                ...s.progress[event.pipeline_id],
                artifacts: event.artifacts,
                joblib_count: event.joblib_count,
                rule_count: event.rule_count,
                total_artifacts: event.total_artifacts,
                logs: [
                  ...s.progress[event.pipeline_id].logs,
                  { id: nextLogId(), ts: event.timestamp, level: "info", message: event.message, node_id: null },
                ],
              },
            },
          }));
        } else if (event.type === "node") {
          set((s) => {
            const p = s.progress[event.pipeline_id];
            const existing = p.nodes.find((n) => n.id === event.node_id);
            const newStatus: "pending" | "running" | "complete" = event.node_status === "complete" ? "complete" : "running";
            const nodes = existing
              ? p.nodes.map((n) =>
                  n.id === event.node_id
                    ? { ...n, status: newStatus, label: event.node_label, category: event.category }
                    : n,
                )
              : [...p.nodes, { id: event.node_id, label: event.node_label, status: newStatus, category: event.category }];
            return {
              progress: {
                ...s.progress,
                [event.pipeline_id]: { ...p, nodes },
              },
            };
          });
        } else if (event.type === "log") {
          set((s) => {
            const p = s.progress[event.pipeline_id];
            return {
              progress: {
                ...s.progress,
                [event.pipeline_id]: {
                  ...p,
                  logs: [
                    ...p.logs,
                    { id: nextLogId(), ts: event.timestamp, level: event.level, message: event.message, node_id: event.node_id },
                  ],
                },
              },
            };
          });
        } else if (event.type === "pipeline_complete") {
          set((s) => ({
            progress: {
              ...s.progress,
              [event.pipeline_id]: {
                ...s.progress[event.pipeline_id],
                status: event.summary ? "complete" : "failed",
                summary: event.summary,
                error: event.error,
                completedAt: event.timestamp,
              },
            },
          }));
        } else if (event.type === "comparison_complete") {
          const results = event.results.map((r: any) => ({
            ...r,
            summary: r.summary as ExecutionSummary | null,
            results: r.results as FullResults | null,
          })) as ComparisonResult[];
          set({
            status: "completed",
            results,
            completedAt: event.timestamp,
          });
        }
      },
      (err) => {
        set({ status: "failed", error: err.message });
      },
    );
    set({ closeStream: close });
  },

  reset: () => {
    get().closeStream?.();
    set({
      status: "idle",
      progress: {},
      results: null,
      error: null,
      startedAt: null,
      completedAt: null,
      closeStream: null,
    });
  },
}));
