import type { Edge, Node } from "@xyflow/react";

export type NodeCategory =
  | "input"
  | "preprocessing"
  | "feature"
  | "detection"
  | "output";

export type DetectionSubType = "clustering" | "anomaly" | "classification";

export interface PaletteNodeDef {
  /** Stable id used to look up the definition when instantiating. */
  type: string;
  label: string;
  category: NodeCategory;
  /** Only present for detection nodes — drives sub-grouping in the palette. */
  detectionSubType?: DetectionSubType;
  /** Short helper text shown under the label in the palette. */
  hint?: string;
  /** Default description seeded into the node's properties panel. */
  defaultDescription?: string;
}

export interface PipelineNodeData {
  label: string;
  category: NodeCategory;
  detectionSubType?: DetectionSubType;
  defType: string;
  description: string;
  notes: string;
  [key: string]: unknown;
}

export type PipelineNode = Node<PipelineNodeData, "pipeline">;
export type PipelineEdge = Edge;

export interface SavedPipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  createdAt: number;
}

export interface CategoryMeta {
  id: NodeCategory;
  label: string;
  /** Tailwind text/border color token, e.g. "text-accent-600". */
  text: string;
  /** Tailwind bg tint, e.g. "bg-accent-50". */
  tint: string;
  /** Hex used for the canvas node's left border + handles. */
  accent: string;
  /** Soft hex for the node header background. */
  soft: string;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export type ToastKind = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export type { Edge, Node };
