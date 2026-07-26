/**
 * Zustand store that orchestrates a single active execution:
 * starts it via REST, streams progress over WebSocket, and exposes
 * node status + log lines + final results to the Execution Console.
 */
import { create } from "zustand";
import {
  openExecutionSocket,
  startExecution,
  type ExecuteRequestBody,
} from "./api";
import { getSampleDataset } from "./api";
import type {
  DatasetInfo,
  ExecutionResults,
  FlaggedOverTimePoint,
  SavedPipelineShape,
  WsMessage,
} from "./types";

export type NodeStatus = "pending" | "running" | "complete";

export interface NodeProgress {
  id: string;
  label: string;
  status: NodeStatus;
  category: string;
}

export interface LogLine {
  id: string;
  ts: string;
  level: "info" | "error";
  node_id: string | null;
  message: string;
}

interface ExecutionState {
  activeExecId: string | null;
  status: "idle" | "starting" | "running" | "completed" | "failed";
  nodes: NodeProgress[];
  logs: LogLine[];
  results: ExecutionResults | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  closeSocket: (() => void) | null;
  sampleDataset: DatasetInfo | null;

  loadSampleDataset: () => Promise<void>;
  run: (pipeline: SavedPipelineShape, datasetRef: string | null) => Promise<void>;
  reset: () => void;
}

let logSeq = 0;
function nextLogId() {
  logSeq += 1;
  return `log_${Date.now().toString(36)}_${logSeq}`;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  activeExecId: null,
  status: "idle",
  nodes: [],
  logs: [],
  results: null,
  error: null,
  startedAt: null,
  completedAt: null,
  closeSocket: null,
  sampleDataset: null,

  loadSampleDataset: async () => {
    if (get().sampleDataset) return;
    try {
      const ds = await getSampleDataset();
      set({ sampleDataset: ds });
    } catch {
      /* non-fatal */
    }
  },

  run: async (pipeline, datasetRef) => {
    // Tear down any prior session.
    get().closeSocket?.();
    set({
      activeExecId: null,
      status: "starting",
      nodes: pipeline.nodes.map((n: any) => ({
        id: n.id,
        label: n.data?.label ?? n.id,
        status: "pending",
        category: n.data?.category ?? "unknown",
      })),
      logs: [],
      results: null,
      error: null,
      startedAt: null,
      completedAt: null,
    });

    const body: ExecuteRequestBody = {
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name,
      pipeline: { id: pipeline.id, name: pipeline.name, nodes: pipeline.nodes, edges: pipeline.edges },
      dataset_ref: datasetRef,
    };

    try {
      const { execution_id, started_at } = await startExecution(body);
      set({ activeExecId: execution_id, status: "running", startedAt: started_at });

      const close = openExecutionSocket(execution_id, (raw) => {
        const msg = raw as WsMessage;
        if (msg.type === "node") {
          set((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === msg.node_id
                ? { ...n, status: msg.node_status === "complete" ? "complete" : "running" }
                : n,
            ),
          }));
        } else if (msg.type === "log") {
          set((s) => ({
            logs: [
              ...s.logs,
              {
                id: nextLogId(),
                ts: msg.timestamp,
                level: msg.level,
                node_id: msg.node_id,
                message: msg.message,
              },
            ],
          }));
        } else if (msg.type === "complete") {
          set((s) => ({
            status: "completed",
            results: msg.results,
            completedAt: msg.timestamp,
            logs: [
              ...s.logs,
              {
                id: nextLogId(),
                ts: msg.timestamp,
                level: "info",
                node_id: null,
                message: msg.message,
              },
            ],
          }));
        } else if (msg.type === "error") {
          set((s) => ({
            status: "failed",
            error: msg.message,
            logs: [
              ...s.logs,
              {
                id: nextLogId(),
                ts: msg.timestamp,
                level: "error",
                node_id: null,
                message: msg.message,
              },
            ],
          }));
        }
      });
      set({ closeSocket: close });
    } catch (e) {
      set({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () => {
    get().closeSocket?.();
    set({
      activeExecId: null,
      status: "idle",
      nodes: [],
      logs: [],
      results: null,
      error: null,
      startedAt: null,
      completedAt: null,
      closeSocket: null,
    });
  },
}));

export type { FlaggedOverTimePoint };
