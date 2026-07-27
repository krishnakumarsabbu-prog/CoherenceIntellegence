import { useQuery } from "@tanstack/react-query";

const API_BASE = "/api";

export interface AlgorithmParam {
  name: string;
  type: "number" | "integer" | "enum" | "boolean" | "string";
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  hint: string;
}

export interface AlgorithmSummary {
  id: string;
  name: string;
  oneLine: string;
  complexity: string;
  stability: string;
  version: string;
}

export interface AlgorithmDetail {
  id: string;
  name: string;
  category: string;
  tab?: string;
  oneLine: string;
  complexity: "Low" | "Medium" | "High";
  inputType: string;
  outputType: string;
  stability: "Stable" | "Beta";
  version: string;
  advantages: string[];
  disadvantages: string[];
  parameters: AlgorithmParam[];
  exampleUseCase: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Live-fetch the list of algorithms for a category (dropdown options). */
export function useAlgorithmsForCategory(category: string | undefined) {
  return useQuery({
    queryKey: ["algorithms", "category", category],
    queryFn: () =>
      fetchJson<{ category: string; algorithms: AlgorithmSummary[] }>(
        `/algorithms/${category}`,
      ),
    enabled: Boolean(category),
    staleTime: 60_000,
  });
}

/** Live-fetch all algorithms with full details for the Algorithm Library. */
export function useAllAlgorithmsWithDetails() {
  return useQuery({
    queryKey: ["algorithms", "all-full"],
    queryFn: () =>
      fetchJson<{ categories: string[]; algorithms: AlgorithmDetail[] }>(
        `/algorithms?full=true`,
      ),
    staleTime: 60_000,
  });
}

/** Live-fetch the full detail (with parameter schema) for one algorithm id. */
export function useAlgorithmDetail(algorithmId: string | undefined) {
  return useQuery({
    queryKey: ["algorithms", "detail", algorithmId],
    queryFn: () =>
      fetchJson<{ algorithm: AlgorithmDetail }>(`/algorithms/${algorithmId}`),
    enabled: Boolean(algorithmId),
    staleTime: 60_000,
  });
}

/** Build the default parameter values object from a fetched algorithm detail. */
export function defaultParamsFromDetail(
  detail: AlgorithmDetail,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of detail.parameters) {
    out[p.name] = p.default;
  }
  return out;
}

/**
 * Map a node's category + detection sub-type to the backend algorithm
 * category string used in GET /algorithms/{category}.
 */
export function categoryForNode(
  category: string,
  detectionSubType?: string,
): string | undefined {
  if (category === "feature") return "feature-engineering";
  if (category === "detection") {
    if (detectionSubType === "clustering") return "clustering";
    if (detectionSubType === "anomaly") return "anomaly-detection";
    if (detectionSubType === "classification") return "classification";
  }
  return undefined;
}
