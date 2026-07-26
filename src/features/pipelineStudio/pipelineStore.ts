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
import {
  algorithmForDefType,
  defaultParamsFor,
} from "../../data/algorithms";
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
  saveCurrent: (name: string) => void;
  loadPipeline: (id: string) => void;
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

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  savedPipelines: [],
  activePipelineId: null,
  activePipelineName: "Untitled pipeline",
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
    const algo = algorithmForDefType(defType);
    const data: PipelineNodeData = {
      label: def.label,
      category: def.category,
      detectionSubType: def.detectionSubType,
      defType: def.type,
      description: def.defaultDescription ?? "",
      notes: "",
      algorithmId: algo?.id,
      params: algo ? defaultParamsFor(algo.id) : undefined,
    };
    const node: PipelineNode = {
      id,
      type: "pipeline",
      position,
      data,
    };
    commit(set, get, () => ({ nodes: [...get().nodes, node] }));
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
      nodes: previous.nodes,
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
      nodes: next.nodes,
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
    const now = Date.now();
    if (activePipelineId) {
      const updated = savedPipelines.map((p) =>
        p.id === activePipelineId
          ? { ...p, name: trimmed, nodes, edges, createdAt: now }
          : p,
      );
      set({
        savedPipelines: updated,
        activePipelineName: trimmed,
      });
    } else {
      const id = nextId("pipe");
      const record: SavedPipeline = {
        id,
        name: trimmed,
        nodes,
        edges,
        createdAt: now,
      };
      set({
        savedPipelines: [...savedPipelines, record],
        activePipelineId: id,
        activePipelineName: trimmed,
      });
    }
  },

  loadPipeline: (id) => {
    const rec = get().savedPipelines.find((p) => p.id === id);
    if (!rec) return;
    set({
      nodes: rec.nodes.map((n) => ({ ...n })),
      edges: rec.edges.map((e) => ({ ...e })),
      activePipelineId: rec.id,
      activePipelineName: rec.name,
      selectedNodeId: null,
      past: [],
      future: [],
    });
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
    if (!hasOutput) {
      issues.push({
        level: "error",
        message:
          "Pipeline has no OUTPUT node — add at least one output stage.",
      });
    }
    const detectionNodes = nodes.filter(
      (n) => n.data.category === "detection",
    );
    for (const det of detectionNodes) {
      const hasOutgoing = edges.some((e) => e.source === det.id);
      if (!hasOutgoing) {
        issues.push({
          level: "warning",
          message: `Detection node "${det.data.label}" has no downstream connection — connect it to an OUTPUT node.`,
        });
      }
    }
    const orphanInputs = nodes.filter(
      (n) => n.data.category !== "input",
    );
    for (const node of orphanInputs) {
      const hasIncoming = edges.some((e) => e.target === node.id);
      if (!hasIncoming) {
        issues.push({
          level: "warning",
          message: `Node "${node.data.label}" has no incoming connection.`,
        });
      }
    }
    if (issues.length === 0) {
      issues.push({
        level: "warning",
        message: "Validation passed — no structural issues detected.",
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
