/**
 * Thin API client for the CoherenceIQ backend.
 * All paths are prefixed with /api so Vite proxies them to FastAPI on :8000.
 */
import type {
  DatasetInfo,
  ExecutionRecord,
  ExecutionResults,
  SavedPipelineShape,
} from "./types";

const API_BASE = "/api";

export interface ExecuteRequestBody {
  pipeline_id: string;
  pipeline_name: string;
  pipeline: SavedPipelineShape;
  dataset_ref?: string | null;
}

export async function startExecution(
  body: ExecuteRequestBody,
): Promise<{ execution_id: string; status: string; started_at: string }> {
  const res = await fetch(`${API_BASE}/pipelines/${body.pipeline_id}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to start execution (${res.status})`);
  return res.json();
}

export async function getExecution(execId: string): Promise<ExecutionRecord | null> {
  const res = await fetch(`${API_BASE}/executions/${execId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch execution (${res.status})`);
  return res.json();
}

export async function listExecutions(
  limit = 50,
): Promise<{ executions: ExecutionRecord[]; total: number; distinct_pipelines: number }> {
  const res = await fetch(`${API_BASE}/executions?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to list executions (${res.status})`);
  return res.json();
}

export async function getSampleDataset(): Promise<DatasetInfo> {
  const res = await fetch(`${API_BASE}/datasets/sample`);
  if (!res.ok) throw new Error(`Failed to fetch sample dataset (${res.status})`);
  return res.json();
}

export async function uploadDataset(file: File): Promise<DatasetInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/datasets/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Failed to upload dataset (${res.status})`);
  return res.json();
}

/**
 * Open a WebSocket to /ws/executions/{id} and dispatch messages.
 * Returns a close() function.
 */
export function openExecutionSocket(
  execId: string,
  onMessage: (msg: unknown) => void,
  onClose?: () => void,
): () => void {
  const wsUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws/executions/${execId}`;
  let ws: WebSocket | null = null;
  let closed = false;

  const connect = () => {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data));
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      if (!closed) onClose?.();
    };
    ws.onerror = () => {
      ws?.close();
    };
  };
  connect();

  return () => {
    closed = true;
    ws?.close();
  };
}

export async function fetchResults(execId: string): Promise<ExecutionResults | null> {
  const ex = await getExecution(execId);
  return ex?.results ?? null;
}
