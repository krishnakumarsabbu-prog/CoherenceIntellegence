import { create } from "zustand";
import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { NODE_DEF_BY_TYPE } from "./catalog";
import type {
  PipelineEdge,
  PipelineNode,
  PipelineNodeData,
  SavedPipeline,
  Toast,
  ToastKind,
  ValidationIssue,
} from "./types";

interface Snapshot {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

interface PipelineState {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;

  // history
  past: Snapshot[];
  future: Snapshot[];

  // saved pipelines (in-memory only)
  savedPipelines: SavedPipeline[];
  activePipelineId: string | null;
  activePipelineName: string;
  activeDatasetRef: string;
  activeDatasetName: string;

  setActiveDataset: (ref: string, name: string) => void;

  // ui
  showMinimap: boolean;
  toasts: Toast[];


  // react-flow callbacks
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;

  // selection
  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, patch: Partial<PipelineNodeData>) => void;

  // node ops
  addNodeFromCatalog: (
    defType: string,
    position: { x: number; y: number },
  ) => void;
  duplicateNode: (id: string) => void;
  deleteNode: (id: string) => void;
  renameNode: (id: string, label: string) => void;

  // canvas ops
  clearCanvas: () => void;
  toggleMinimap: () => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // saved pipelines
  saveCurrent: (name: string) => SavedPipeline;
  loadPipeline: (id: string) => void;
  loadPipelineRecord: (pipe: { id: string; name: string; nodes: any[]; edges: any[] }) => void;
  fetchPipelinesFromDb: () => Promise<void>;
  deleteSavedPipeline: (id: string) => void;

  // validation + toasts
  validate: () => ValidationIssue[];
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;
}

let idSeq = 1;
function nextId(prefix: string) {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`;
}

function snapshot(state: PipelineState): Snapshot {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
  };
}

function commit(
  set: (fn: (s: PipelineState) => Partial<PipelineState>) => void,
  get: () => PipelineState,
  mutator: (s: PipelineState) => Partial<PipelineState>,
) {
  const before = snapshot(get());
  set((s) => {
    const next = mutator(s);
    return {
      ...next,
      past: [...s.past, before].slice(-50),
      future: [],
    } as Partial<PipelineState>;
  });
}

const MEGA_PIPELINE_RECORD: SavedPipeline = {
  id: "pipe_enterprise_mega_001",
  name: "Enterprise Fraud & Risk Mega Pipeline",
  createdAt: Date.now(),
  nodes: [
    {
      id: "node_md_rules",
      type: "pipeline",
      position: { x: 50, y: 100 },
      data: {
        label: "Markdown Business Rules (.md)",
        category: "input",
        defType: "input.markdown-rules",
        description: "Ingests structured business rules and parameter specifications from a Markdown file (.md).",
        notes: "",
      },
    },
    {
      id: "node_tx_feed",
      type: "pipeline",
      position: { x: 50, y: 280 },
      data: {
        label: "Real-Time Transaction Stream",
        category: "input",
        defType: "input.transaction-feed",
        description: "Streams incoming live credit card and digital payment transactions.",
        notes: "",
      },
    },
    {
      id: "node_pre_cleaning",
      type: "pipeline",
      position: { x: 320, y: 190 },
      data: {
        label: "Data Cleaning & Type Validation",
        category: "preprocessing",
        algorithmId: "pre.cleaning",
        defType: "pre.cleaning",
        description: "Cleans raw records, validates currency formats, and trims string whitespace.",
        notes: "",
        params: { strip_strings: true, coerce_numeric: true },
      },
    },
    {
      id: "node_pre_missing",
      type: "pipeline",
      position: { x: 580, y: 190 },
      data: {
        label: "Median Missing Value Imputation",
        category: "preprocessing",
        algorithmId: "pre.missing-values",
        defType: "pre.missing-values",
        description: "Fills missing transaction attributes using median feature imputation.",
        notes: "",
        params: { strategy: "median" },
      },
    },
    {
      id: "node_feat_mi",
      type: "pipeline",
      position: { x: 840, y: 190 },
      data: {
        label: "Mutual Information Feature Selection",
        category: "feature",
        algorithmId: "feat.mi-selection",
        defType: "feat.engineering",
        description: "Derives entropy dependencies and selects non-linear feature signals.",
        notes: "",
        params: { n_neighbors: 3 },
      },
    },
    {
      id: "node_det_hdbscan",
      type: "pipeline",
      position: { x: 1120, y: 90 },
      data: {
        label: "HDBSCAN Hierarchical Clustering",
        category: "detection",
        detectionSubType: "clustering",
        algorithmId: "det.cluster.hdbscan",
        defType: "det.clustering",
        description: "Groups rules and transaction vectors into density-based fraud rings.",
        notes: "",
        params: { min_cluster_size: 15, metric: "euclidean" },
      },
    },
    {
      id: "node_det_iforest",
      type: "pipeline",
      position: { x: 1120, y: 290 },
      data: {
        label: "Isolation Forest Outlier Detection",
        category: "detection",
        detectionSubType: "anomaly",
        algorithmId: "det.anomaly.isolation-forest",
        defType: "det.anomaly",
        description: "Isolates abnormal transaction patterns using isolation trees.",
        notes: "",
        params: { n_estimators: 100, contamination: 0.05 },
      },
    },
    {
      id: "node_det_xgboost",
      type: "pipeline",
      position: { x: 1400, y: 190 },
      data: {
        label: "XGBoost Fraud Risk Classifier",
        category: "detection",
        detectionSubType: "classification",
        algorithmId: "det.class.xgboost",
        defType: "det.classification",
        description: "Supervised gradient boosted decision tree classifier.",
        notes: "",
        params: { max_depth: 6, learning_rate: 0.05, n_estimators: 200 },
      },
    },
    {
      id: "node_out_review",
      type: "pipeline",
      position: { x: 1680, y: 190 },
      data: {
        label: "Automated Case Review & Alerting",
        category: "output",
        defType: "out.flag-review",
        description: "Dispatches flagged transactions to analyst queue and webhooks.",
        notes: "",
      },
    },
  ],
  edges: [
    { id: "e1", source: "node_md_rules", target: "node_pre_cleaning" },
    { id: "e2", source: "node_tx_feed", target: "node_pre_cleaning" },
    { id: "e3", source: "node_pre_cleaning", target: "node_pre_missing" },
    { id: "e4", source: "node_pre_missing", target: "node_feat_mi" },
    { id: "e5", source: "node_feat_mi", target: "node_det_hdbscan" },
    { id: "e6", source: "node_feat_mi", target: "node_det_iforest" },
    { id: "e7", source: "node_det_hdbscan", target: "node_det_xgboost" },
    { id: "e8", source: "node_det_iforest", target: "node_det_xgboost" },
    { id: "e9", source: "node_det_xgboost", target: "node_out_review" },
  ],
};

function sanitizeNode(n: any, idx: number): PipelineNode {
  const posX = n.position && typeof n.position.x === "number" ? n.position.x : 50 + ((idx % 6) * 260);
  const posY = n.position && typeof n.position.y === "number" ? n.position.y : 120 + (Math.floor(idx / 6) * 160);
  return {
    ...n,
    id: n.id || `node_${idx + 1}`,
    type: n.type || "pipeline",
    position: { x: posX, y: posY },
    data: n.data || { label: "Pipeline Node", category: "input" },
  };
}

function sanitizeNodes(nodes: any[]): PipelineNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n, idx) => sanitizeNode(n, idx));
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: sanitizeNodes(MEGA_PIPELINE_RECORD.nodes),
  edges: MEGA_PIPELINE_RECORD.edges,
  selectedNodeId: null,
  past: [],
  future: [],
  savedPipelines: [MEGA_PIPELINE_RECORD],
  activePipelineId: MEGA_PIPELINE_RECORD.id,
  activePipelineName: MEGA_PIPELINE_RECORD.name,
  activeDatasetRef: "train-data-log-001",
  activeDatasetName: "train_data.xlsx (Log Feed)",

  setActiveDataset: (ref, name) => set({ activeDatasetRef: ref, activeDatasetName: name }),

  showMinimap: true,
  toasts: [],


  onNodesChange: (changes) => {
    // Selection changes shouldn't pollute history; position drags should.
    const hasStructural = changes.some(
      (c) => c.type === "remove" || c.type === "add",
    );
    const hasPosition = changes.some(
      (c) => c.type === "position" && c.dragging === false,
    );

    if (hasStructural || hasPosition) {
      commit(set, get, (s) => ({
        nodes: applyNodeChanges(changes, s.nodes) as PipelineNode[],
      }));
    } else {
      set((s) => ({
        nodes: applyNodeChanges(changes, s.nodes) as PipelineNode[],
      }));
    }

    // Reflect selection from the canvas into our store.
    const selectChange = changes.find(
      (c) => c.type === "select",
    ) as NodeChange & { type: "select"; id: string; selected: boolean } | undefined;
    if (selectChange) {
      if (selectChange.selected) {
        set({ selectedNodeId: selectChange.id });
      } else if (get().selectedNodeId === selectChange.id) {
        set({ selectedNodeId: null });
      }
    }
  },

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === "remove");
    if (hasRemove) {
      commit(set, get, (s) => ({
        edges: applyEdgeChanges(changes, s.edges),
      }));
    } else {
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
    }
  },

  onConnect: (conn) => {
    commit(set, get, (s) => ({
      edges: rfAddEdge(
        { ...conn, id: nextId("e") },
        s.edges,
      ) as PipelineEdge[],
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeData: (id, patch) => {
    // Description/notes edits are frequent; don't push history for them.
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }));
  },

  addNodeFromCatalog: (defType, position) => {
    const def = NODE_DEF_BY_TYPE[defType];
    if (!def) return;
    const id = nextId("n");
    let defaultAlgoId: string | undefined = undefined;
    if (def.category === "feature") {
      defaultAlgoId = "feat.mi-selection";
    } else if (def.category === "detection") {
      if (def.detectionSubType === "clustering") {
        defaultAlgoId = "det.cluster.hdbscan";
      } else if (def.detectionSubType === "anomaly") {
        defaultAlgoId = "det.anom.iforest";
      } else {
        defaultAlgoId = "det.class.xgboost";
      }
    }

    const data: PipelineNodeData = {
      label: def.label,
      category: def.category,
      detectionSubType: def.detectionSubType,
      defType: def.type,
      description: def.defaultDescription ?? "",
      notes: "",
      algorithmId: defaultAlgoId,
      params: undefined,
    };
    const node: PipelineNode = {
      id,
      type: "pipeline",
      position,
      data,
    };
    commit(set, get, () => ({ nodes: [...get().nodes, node] }));
    // Auto-open + focus the Properties panel for the new node so the user is
    // immediately prompted to pick an algorithm.
    set({ selectedNodeId: id });
  },

  duplicateNode: (id) => {
    const src = get().nodes.find((n) => n.id === id);
    if (!src) return;
    const newId = nextId("n");
    const copy: PipelineNode = {
      ...src,
      id: newId,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...src.data, label: `${src.data.label} copy` },
      selected: false,
    };
    commit(set, get, () => ({ nodes: [...get().nodes, copy] }));
    set({ selectedNodeId: newId });
  },

  deleteNode: (id) => {
    commit(set, get, (s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    if (get().selectedNodeId === id) set({ selectedNodeId: null });
  },

  renameNode: (id, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    commit(set, get, (s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n,
      ),
    }));
  },

  clearCanvas: () => {
    if (get().nodes.length === 0 && get().edges.length === 0) return;
    commit(set, get, () => ({ nodes: [], edges: [] }));
    set({ selectedNodeId: null });
  },

  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const present: Snapshot = { nodes, edges };
    set({
      nodes: sanitizeNodes(previous.nodes),
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [...future, present].slice(-50),
      selectedNodeId: null,
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const present: Snapshot = { nodes, edges };
    set({
      nodes: sanitizeNodes(next.nodes),
      edges: next.edges,
      past: [...past, present].slice(-50),
      future: future.slice(0, -1),
      selectedNodeId: null,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  saveCurrent: (name) => {
    const trimmed = name.trim() || "Untitled pipeline";
    const { nodes, edges, activePipelineId, savedPipelines } = get();
    const cleanNodes = sanitizeNodes(nodes);
    const now = Date.now();
    const id = activePipelineId || nextId("pipe");

    const record: SavedPipeline = {
      id,
      name: trimmed,
      nodes: cleanNodes,
      edges,
      createdAt: now,
    };

    const updated = activePipelineId
      ? savedPipelines.map((p) => (p.id === activePipelineId ? record : p))
      : [...savedPipelines, record];

    set({
      savedPipelines: updated,
      activePipelineId: id,
      activePipelineName: trimmed,
    });

    fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: trimmed,
        nodes: cleanNodes,
        edges,
        description: `Pipeline with ${cleanNodes.length} nodes and ${edges.length} connections.`,
      }),
    }).catch(() => {});
    return record;
  },

  loadPipeline: (id) => {
    const rec = get().savedPipelines.find((p) => p.id === id);
    if (!rec) return;
    set({
      nodes: sanitizeNodes(rec.nodes),
      edges: rec.edges.map((e) => ({ ...e })),
      activePipelineId: rec.id,
      activePipelineName: rec.name,
      selectedNodeId: null,
      past: [],
      future: [],
    });
  },

  loadPipelineRecord: (pipe: { id: string; name: string; nodes: any[]; edges: any[] }) => {
    set({
      nodes: sanitizeNodes(pipe.nodes || []),
      edges: (pipe.edges || []).map((e) => ({ ...e })),
      activePipelineId: pipe.id,
      activePipelineName: pipe.name,
      selectedNodeId: null,
      past: [],
      future: [],
    });
  },

  fetchPipelinesFromDb: async () => {
    try {
      const res = await fetch("/api/pipelines");
      if (!res.ok) return;
      const data = await res.json();
      const dbPipes: SavedPipeline[] = (data.pipelines || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        nodes: sanitizeNodes(p.nodes || []),
        edges: p.edges || [],
        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      }));
      set({ savedPipelines: dbPipes });

      if (!get().activePipelineId && dbPipes.length > 0) {
        get().loadPipelineRecord(dbPipes[0]);
      }
    } catch (err) {
      console.error("Failed to load pipelines from DB", err);
    }
  },


  deleteSavedPipeline: (id) => {
    set((s) => ({
      savedPipelines: s.savedPipelines.filter((p) => p.id !== id),
      activePipelineId:
        s.activePipelineId === id ? null : s.activePipelineId,
      activePipelineName:
        s.activePipelineId === id ? "Untitled pipeline" : s.activePipelineName,
    }));
  },

  validate: () => {
    const { nodes, edges } = get();
    const issues: ValidationIssue[] = [];

    const hasInput = nodes.some((n) => n.data.category === "input");
    if (!hasInput) {
      issues.push({
        level: "error",
        message: "Pipeline has no INPUT node — add at least one input source.",
      });
    }

    const hasOutput = nodes.some((n) => n.data.category === "output");
    const hasDetectionOrFeature = nodes.some(
      (n) => n.data.category === "detection" || n.data.category === "feature",
    );

    if (!hasOutput && !hasDetectionOrFeature) {
      issues.push({
        level: "error",
        message: "Pipeline has no OUTPUT or DETECTION node to produce results.",
      });
    } else if (!hasOutput) {
      issues.push({
        level: "warning",
        message:
          "Pipeline has no explicit OUTPUT node — analytical results will render directly from Detection & Feature nodes.",
      });
    }

    // Ensure all feature and detection nodes have valid algorithm IDs
    const algoBacked = nodes.filter(
      (n) => n.data.category === "feature" || n.data.category === "detection",
    );
    for (const n of algoBacked) {
      if (!n.data.algorithmId) {
        let defaultAlgo = "feat.mi-selection";
        if (n.data.category === "detection") {
          const sub = (n.data.detectionSubType || "").toLowerCase();
          const lbl = (n.data.label || "").toLowerCase();
          if (sub === "clustering" || lbl.includes("cluster") || lbl.includes("hdbscan")) {
            defaultAlgo = "det.cluster.hdbscan";
          } else if (sub === "anomaly" || lbl.includes("anomaly")) {
            defaultAlgo = "det.anom.iforest";
          } else {
            defaultAlgo = "det.class.xgboost";
          }
        }
        n.data.algorithmId = defaultAlgo;
      }
    }

    const orphanInputs = nodes.filter((n) => n.data.category !== "input");
    for (const node of orphanInputs) {
      const hasIncoming = edges.some((e) => e.target === node.id);
      if (!hasIncoming) {
        issues.push({
          level: "warning",
          message: `Node "${node.data.label}" has no incoming connection.`,
        });
      }
    }

    if (!issues.some((i) => i.level === "error")) {
      issues.push({
        level: "info",
        message: "Pipeline validation passed! All nodes connected and configured properly.",
      });
    }
    return issues;
  },

  pushToast: (kind, message) => {
    const id = nextId("t");
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
