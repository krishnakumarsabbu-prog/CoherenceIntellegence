import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { usePipelineStore } from "./pipelineStore";
import PipelineNode from "./components/PipelineNode";
import NodePalette from "./components/NodePalette";
import PropertiesPanel from "./components/PropertiesPanel";
import CanvasToolbar from "./components/CanvasToolbar";
import ToastStack from "./components/ToastStack";
import NodeContextMenu, {
  type ContextMenuState,
} from "./components/NodeContextMenu";
import { CATEGORY_META } from "./catalog";
import type { NodeCategory } from "./types";

const nodeTypes = { pipeline: PipelineNode };

interface DbPipeline {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  created_at?: string;
  updated_at?: string;
}

export default function PipelineStudioPage() {
  const navigate = useNavigate();
  const loadPipelineRecord = usePipelineStore((s) => s.loadPipelineRecord);
  const saveCurrent = usePipelineStore((s) => s.saveCurrent);
  const pushToast = usePipelineStore((s) => s.pushToast);

  const [viewMode, setViewMode] = useState<"dashboard" | "studio">("dashboard");
  const [pipelines, setPipelines] = useState<DbPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPipeName, setNewPipeName] = useState("");
  const [newPipeDesc, setNewPipeDesc] = useState("");
  const [newPipeTemplate, setNewPipeTemplate] = useState<"md-rules" | "anomaly" | "blank">("md-rules");

  // Fetch pipelines from SQLite DB
  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipelines");
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      const data = await res.json();
      setPipelines(data.pipelines || []);
    } catch (err: any) {
      pushToast("error", "Error loading pipelines from Database: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleOpenStudio = (pipe: DbPipeline) => {
    loadPipelineRecord(pipe);
    setViewMode("studio");
  };

  const handleRunPipeline = (pipe: DbPipeline) => {
    loadPipelineRecord(pipe);
    saveCurrent(pipe.name);
    navigate("/execution-console");
  };

  const handleDeletePipeline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this pipeline from the database?")) return;
    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
      if (res.ok) {
        pushToast("info", "Pipeline deleted from database.");
        fetchPipelines();
      }
    } catch (err: any) {
      pushToast("error", "Failed to delete pipeline.");
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPipeName.trim() || "New Fraud Detection Pipeline";
    const pipeId = `pipe-${Date.now().toString(36)}`;

    let nodes: any[] = [];
    let edges: any[] = [];

    if (newPipeTemplate === "md-rules") {
      nodes = [
        {
          id: "n1",
          type: "pipeline",
          position: { x: 250, y: 120 },
          data: {
            category: "input",
            defType: "input.markdown-rules",
            label: "Markdown Rules (.md)",
            description: "Dynamic rule AST ingestion",
            params: { fileName: "RULE_PARAMETER_MAPPING.md" },
          },
        },
        {
          id: "n2",
          type: "pipeline",
          position: { x: 250, y: 280 },
          data: {
            category: "feature",
            defType: "feat.engineering",
            label: "Mutual Information Selection",
            algorithmId: "feat.mi-selection",
            description: "Select top informative signals",
          },
        },
        {
          id: "n3",
          type: "pipeline",
          position: { x: 250, y: 440 },
          data: {
            category: "detection",
            defType: "det.clustering",
            detectionSubType: "clustering",
            label: "HDBSCAN Clustering",
            algorithmId: "det.cluster.hdbscan",
            description: "Clusters uploaded rules by feature matrix",
          },
        },
      ];
      edges = [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ];
    } else if (newPipeTemplate === "anomaly") {
      nodes = [
        {
          id: "n1",
          type: "pipeline",
          position: { x: 250, y: 120 },
          data: {
            category: "input",
            defType: "input.transaction-feed",
            label: "Transaction Stream",
            description: "Live transaction feed",
          },
        },
        {
          id: "n2",
          type: "pipeline",
          position: { x: 250, y: 280 },
          data: {
            category: "detection",
            defType: "det.anomaly",
            detectionSubType: "anomaly",
            label: "Isolation Forest Anomaly",
            algorithmId: "det.anom.iforest",
            description: "Unsupervised outlier scoring",
          },
        },
      ];
      edges = [{ id: "e1", source: "n1", target: "n2" }];
    }

    const payload = {
      id: pipeId,
      name,
      description: newPipeDesc.trim() || "Custom fraud intelligence analytical pipeline.",
      nodes,
      edges,
    };

    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        pushToast("success", `Pipeline "${name}" created and saved to DB!`);
        setIsCreateModalOpen(false);
        setNewPipeName("");
        setNewPipeDesc("");
        fetchPipelines();
        handleOpenStudio(data.pipeline);
      }
    } catch (err: any) {
      pushToast("error", "Failed to create pipeline: " + err.message);
    }
  };

  const filteredPipelines = pipelines.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <ReactFlowProvider>
      {viewMode === "dashboard" ? (
        <PipelineDashboard
          pipelines={filteredPipelines}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={fetchPipelines}
          onOpenStudio={handleOpenStudio}
          onRunPipeline={handleRunPipeline}
          onDeletePipeline={handleDeletePipeline}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <Studio onBackToDashboard={() => {
          fetchPipelines();
          setViewMode("dashboard");
        }} />
      )}

      {/* Create New Pipeline Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-canvas-200 w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-canvas-100 pb-3">
              <h3 className="text-lg font-bold text-canvas-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-600"></span>
                Create New Pipeline
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-canvas-400 hover:text-canvas-700"
              >
                âœ•
              </button>
            </div>

            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-canvas-700 mb-1">
                  Pipeline Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPipeName}
                  onChange={(e) => setNewPipeName(e.target.value)}
                  placeholder="e.g. Rule-to-Cluster Analytics Pipeline"
                  className="input w-full text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-canvas-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newPipeDesc}
                  onChange={(e) => setNewPipeDesc(e.target.value)}
                  placeholder="Brief overview of the pipeline purpose..."
                  className="input w-full text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-canvas-700 mb-1">
                  Preset Canvas Template
                </label>
                <select
                  value={newPipeTemplate}
                  onChange={(e: any) => setNewPipeTemplate(e.target.value)}
                  className="input w-full text-xs font-medium bg-white"
                >
                  <option value="md-rules">Markdown Rules & HDBSCAN Clustering (Recommended)</option>
                  <option value="anomaly">Transaction Stream & Isolation Forest Anomaly</option>
                  <option value="blank">Blank Canvas (Custom)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-canvas-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-1.5 px-4 shadow-sm">
                  Create & Open Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ReactFlowProvider>
  );
}

function PipelineDashboard({
  pipelines,
  loading,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onOpenStudio,
  onRunPipeline,
  onDeletePipeline,
  onOpenCreateModal,
}: {
  pipelines: DbPipeline[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRefresh: () => void;
  onOpenStudio: (p: DbPipeline) => void;
  onRunPipeline: (p: DbPipeline) => void;
  onDeletePipeline: (id: string, e: React.MouseEvent) => void;
  onOpenCreateModal: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-canvas-50 p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-canvas-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-50 text-accent-600 border border-accent-100">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="12" cy="18" r="2.5" />
                <path d="M8 7.5L11 16M16 7.5L13 16M8 6h8" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-canvas-900">
                Pipeline Studio & Analytical Dashboard
              </h1>
              <p className="text-xs text-canvas-500 mt-0.5">
                Manage, edit, and execute ML analytical pipelines persisted directly in SQLite DB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="btn-ghost text-xs px-3 py-2 border border-canvas-200 bg-white hover:bg-canvas-50 font-medium"
            title="Sync with DB"
          >
            â†» Sync DB
          </button>

          <button
            onClick={onOpenCreateModal}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2 shadow-sm font-semibold"
          >
            <span className="text-base font-bold">+</span>
            <span>Create New Pipeline</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved pipelines by name or description..."
            className="input w-full text-xs pl-9 pr-4 py-2 bg-white border border-canvas-200 rounded-lg shadow-sm"
          />
          <svg className="w-4 h-4 text-canvas-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        <span className="text-xs text-canvas-500 font-medium">
          Showing <span className="font-bold text-canvas-800">{pipelines.length}</span> saved pipeline(s)
        </span>
      </div>

      {/* Pipelines Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-white border border-canvas-200 p-5 animate-pulse space-y-4">
              <div className="h-4 bg-canvas-100 rounded w-2/3" />
              <div className="h-3 bg-canvas-100 rounded w-5/6" />
              <div className="h-8 bg-canvas-100 rounded w-full mt-6" />
            </div>
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="bg-white rounded-xl border border-canvas-200 p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center mx-auto">
            âš¡
          </div>
          <h3 className="text-base font-bold text-canvas-800">No Pipelines Found</h3>
          <p className="text-xs text-canvas-500">
            You haven't created any pipelines yet. Click below to create your first rule-to-cluster pipeline.
          </p>
          <button
            onClick={onOpenCreateModal}
            className="btn-primary text-xs py-2 px-4 shadow-sm"
          >
            + Create New Pipeline
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pipelines.map((pipe) => {
            const nodeCategories = (pipe.nodes || []).map(
              (n: any) => n.data?.label || n.data?.category || "Node",
            );
            return (
              <div
                key={pipe.id}
                onClick={() => onOpenStudio(pipe)}
                className="group relative bg-white border border-canvas-200 hover:border-accent-400 hover:shadow-md transition-all duration-200 rounded-xl p-5 flex flex-col justify-between cursor-pointer space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent-600 group-hover:scale-125 transition-transform" />
                      <h3 className="text-sm font-bold text-canvas-900 group-hover:text-accent-600 transition-colors">
                        {pipe.name}
                      </h3>
                    </div>

                    <button
                      onClick={(e) => onDeletePipeline(pipe.id, e)}
                      className="text-canvas-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                      title="Delete pipeline from DB"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-xs text-canvas-500 line-clamp-2 leading-relaxed">
                    {pipe.description || "Analytical pipeline configured with user rules and ML models."}
                  </p>
                </div>

                {/* Node Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nodeCategories.map((cat: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-canvas-100 text-canvas-700 border border-canvas-200 truncate max-w-[130px]"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-3 border-t border-canvas-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-canvas-500 font-medium text-[11px]">
                    <span>{(pipe.nodes || []).length} Nodes</span>
                    <span>â€¢</span>
                    <span>{(pipe.edges || []).length} Edges</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudio(pipe);
                      }}
                      className="btn-ghost text-xs !py-1 !px-2.5 font-semibold text-accent-700 hover:bg-accent-50"
                    >
                      Studio ðŸŽ¨
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunPipeline(pipe);
                      }}
                      className="btn-primary text-xs !py-1 !px-2.5 shadow-sm font-semibold"
                    >
                      Run âš¡
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Studio({ onBackToDashboard }: { onBackToDashboard: () => void }) {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNodeFromCatalog = usePipelineStore((s) => s.addNodeFromCatalog);
  const deleteNode = usePipelineStore((s) => s.deleteNode);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const validate = usePipelineStore((s) => s.validate);
  const showMinimap = usePipelineStore((s) => s.showMinimap);
  const activePipelineName = usePipelineStore((s) => s.activePipelineName);

  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(420);
  const [trainCells, setTrainCells] = useState<TrainCell[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const id = usePipelineStore.getState().selectedNodeId;
        if (id) { e.preventDefault(); deleteNode(id); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) usePipelineStore.getState().redo();
        else usePipelineStore.getState().undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteNode]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const defType = e.dataTransfer.getData("application/x-pipeline-node");
    if (!defType || !wrapperRef.current || !rfInstance) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    addNodeFromCatalog(defType, { x: position.x - 94, y: position.y - 30 });
  }, [rfInstance, addNodeFromCatalog]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: { id: string }) => {
    e.preventDefault(); selectNode(node.id); setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, [selectNode]);

  const onPaneClick = useCallback(() => { setMenu(null); selectNode(null); }, [selectNode]);

  const handleTrainClick = async (pipelineId: string, datasetRef: string) => {
    setConsoleOpen(true);
    setIsTraining(true);
    setTrainCells([]);
    const pipelineName = activePipelineName;
    const pushCell = (cell: TrainCell) => setTrainCells((prev) => [...prev, cell]);

    pushCell({
      id: "init",
      type: "header",
      content: `⚡ Training Pipeline: ${pipelineName}`,
      ts: new Date().toISOString(),
      status: "running",
    });
    pushCell({
      id: "ds",
      type: "info",
      content: `📁 Dataset Reference: ${datasetRef} • Pipeline ID: ${pipelineId}`,
      ts: new Date().toISOString(),
      status: "ok",
    });

    try {
      const pipeStore = usePipelineStore.getState();
      const pipe = pipeStore.savedPipelines.find((p) => p.id === pipelineId) ?? { id: pipelineId, name: pipelineName, nodes, edges };
      const res = await fetch("/api/pipelines/train-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pipelineId, name: pipelineName, nodes: pipe.nodes, edges: pipe.edges, dataset_ref: datasetRef }),
      });
      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            const cellId = `${evt.type}-${Date.now()}-${Math.random()}`;
            if (evt.type === "start") {
              pushCell({
                id: cellId,
                type: "start",
                content: evt.message || `Starting pipeline: ${pipelineName}`,
                sub: `${evt.row_count} records • Dataset: ${evt.dataset}`,
                ts: new Date().toISOString(),
                status: "ok",
              });
            } else if (evt.type === "log") {
              const t = evt.level === "error" ? "error" : evt.level === "warning" ? "warn" : "log";
              pushCell({
                id: cellId,
                type: t as TrainCell["type"],
                content: evt.message,
                nodeId: evt.node_id,
                ts: evt.timestamp || new Date().toISOString(),
                status: evt.node_status === "complete" ? "ok" : "running",
                extractedFeatures: evt.extracted_features,
                featureCount: evt.feature_count,
                clusters: evt.clusters,
                scoreStats: evt.score_stats,
              });
            } else if (evt.type === "complete") {
              const summary = evt.results?.summary || {};
              const recCount = summary.total_records_scored ?? summary.total_transactions ?? 0;
              const fraudCount = summary.fraud_flagged_count ?? summary.flagged ?? 0;
              const timeSec = summary.execution_time_seconds ?? 0;
              pushCell({
                id: "done",
                type: "complete",
                content: "✅ Pipeline Training Complete! Models fitted and serialized.",
                sub: `${recCount} records evaluated • ${fraudCount} flagged • ${timeSec}s execution time`,
                ts: evt.timestamp ?? new Date().toISOString(),
                status: "ok",
                results: evt.results,
              });
            } else if (evt.type === "artifacts") {
              pushCell({
                id: "arts",
                type: "artifacts",
                content: `💾 ${evt.artifacts_count} Model Artifacts (.joblib) Saved to Registry`,
                artifacts: evt.artifacts,
                ts: new Date().toISOString(),
                status: "ok",
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      pushCell({ id: "err", type: "error", content: `❌ Training failed: ${err.message}`, ts: new Date().toISOString(), status: "error" });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8 border-y border-slate-200 bg-slate-50">
      <div className="flex flex-1 min-h-0">
        <NodePalette collapsed={paletteCollapsed} onToggle={() => setPaletteCollapsed((v) => !v)} onDragStart={() => {}} />
        <div className="flex-1 flex flex-col min-w-0">
          <CanvasToolbar rfInstance={rfInstance} onValidate={validate} onBackToDashboard={onBackToDashboard} onTrainClick={handleTrainClick} />
          {paletteCollapsed && (
            <button onClick={() => setPaletteCollapsed(false)} className="absolute left-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-slate-200 shadow-card rounded-md" title="Show palette">
              <ChevronIcon className="w-4 h-4 text-slate-600" />
            </button>
          )}
          <div className="relative flex-1" ref={wrapperRef}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={setRfInstance} onDrop={onDrop} onDragOver={onDragOver} onNodeContextMenu={onNodeContextMenu} onPaneClick={onPaneClick} onNodeClick={(_e, node) => selectNode(node.id)} fitView fitViewOptions={{ padding: 0.3 }} proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ type: "smoothstep", animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }} className="bg-slate-50">
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#cbd5e1" />
              <Controls showInteractive={false} className="!shadow-md !rounded-lg !border !border-slate-200 !bg-white text-slate-700" />
              {showMinimap && (
                <MiniMap pannable zoomable className="!bg-white !border !border-slate-200 !rounded-lg !shadow-md"
                  nodeColor={(n) => { const cat = (n.data as { category?: NodeCategory })?.category; return cat ? CATEGORY_META[cat]?.accent ?? "#94a3b8" : "#94a3b8"; }}
                  maskColor="rgba(248,250,252,0.75)"
                />
              )}
            </ReactFlow>
            {nodes.length === 0 && <EmptyCanvas />}
            <ToastStack />
          </div>
        </div>
        <PropertiesPanel collapsed={propsCollapsed} onToggle={() => setPropsCollapsed((v) => !v)} />
        {propsCollapsed && (
          <button onClick={() => setPropsCollapsed(false)} className="absolute right-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-slate-200 shadow-card rounded-md" title="Show properties">
            <ChevronIcon className="w-4 h-4 rotate-180 text-slate-600" />
          </button>
        )}
        <NodeContextMenu menu={menu} onClose={() => setMenu(null)} />
      </div>

      <TrainingConsole
        open={consoleOpen}
        height={consoleHeight}
        isTraining={isTraining}
        cells={trainCells}
        onClose={() => setConsoleOpen(false)}
        onClear={() => setTrainCells([])}
        onResize={(h) => setConsoleHeight(Math.max(200, Math.min(h, 720)))}
      />
    </div>
  );
}

interface TrainCell {
  id: string;
  type: "header" | "start" | "info" | "log" | "warn" | "error" | "node" | "complete" | "artifacts";
  content: string;
  sub?: string;
  ts: string;
  status: "running" | "ok" | "error";
  nodeId?: string;
  results?: any;
  artifacts?: string[];
  extractedFeatures?: string[];
  featureCount?: number;
  clusters?: any[];
  scoreStats?: any;
}

function TrainingConsole({ open, height, isTraining, cells, onClose, onClear, onResize }: {
  open: boolean; height: number; isTraining: boolean;
  cells: TrainCell[]; onClose: () => void; onClear: () => void;
  onResize: (h: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [expandedFeaturesCell, setExpandedFeaturesCell] = useState<string | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [cells]);

  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startH: height };
    const move = (ev: MouseEvent) => { if (dragRef.current) onResize(dragRef.current.startH - (ev.clientY - dragRef.current.startY)); };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!open) return null;

  return (
    <div className="flex-shrink-0 border-t border-slate-300 bg-white shadow-2xl flex flex-col font-sans" style={{ height }}>
      {/* Resize handle */}
      <div onMouseDown={handleDragStart}
        className="h-2 bg-slate-200 hover:bg-indigo-500 cursor-row-resize transition-colors group flex items-center justify-center"
        title="Drag to resize console">
        <div className="w-12 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors" />
      </div>

      {/* Jupyter Console Header Bar */}
      <div className="flex items-center justify-between px-4 h-9 bg-slate-100 border-b border-slate-200 shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-200 border border-slate-300 text-slate-700 font-mono font-semibold text-[11px]">
            <svg className="w-3.5 h-3.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
            Jupyter Notebook Console
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className={`w-2 h-2 rounded-full ${isTraining ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-400"}`} />
            <span className="text-slate-600 font-medium">{isTraining ? "Kernel Busy (Executing...)" : "Kernel Idle"}</span>
          </div>
          {cells.length > 0 && (
            <span className="text-[11px] text-slate-500 font-mono">
              • {cells.length} executed cell(s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-[11px] font-mono font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-sm">
            Clear Outputs
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-all" title="Close Console">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Jupyter Notebook Output Cells Container */}
      <div className="overflow-y-auto bg-[#f8fafc] font-mono text-xs p-4 space-y-4 flex-1">
        {cells.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-12">
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Awaiting Training Run...</span>
            <p className="text-[11px] text-slate-400 font-sans">Click ⚡ Train & Save to fit models and view live Jupyter Notebook telemetry cells.</p>
          </div>
        )}

        {cells.map((cell, idx) => {
          const cellNum = idx + 1;
          const recCount = cell.results?.summary?.total_records_scored ?? cell.results?.summary?.total_transactions ?? 0;
          const fraudCount = cell.results?.summary?.fraud_flagged_count ?? cell.results?.summary?.flagged ?? 0;
          const precision = cell.results?.summary?.precision ?? 0;
          const recall = cell.results?.summary?.recall ?? 0;
          const f1 = cell.results?.summary?.f1 ?? 0;
          const execTime = cell.results?.summary?.execution_time_seconds ?? 0;

          return (
            <div key={cell.id + idx} className="flex gap-2 items-start font-mono group">
              {/* Left Jupyter Cell Prompt */}
              <div className="w-16 shrink-0 text-right text-[11px] font-bold select-none pt-1">
                <span className="text-[#000080]">In [{cellNum}]:</span>
              </div>

              {/* Notebook Cell Content Box */}
              <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {/* Cell Header Strip */}
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 font-sans font-medium text-slate-700">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                      {cell.type}
                    </span>
                    <span>{cell.content}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{cell.ts.slice(11, 19)}</span>
                </div>

                {/* Notebook Output Area */}
                <div className="p-3 font-mono text-xs text-slate-800 space-y-2">
                  {cell.sub && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 font-sans">
                      {cell.sub}
                    </div>
                  )}

                  {/* 1. Feature Engineering Output Cell (Printing all 55 features) */}
                  {cell.extractedFeatures && cell.extractedFeatures.length > 0 && (
                    <div className="mt-2 space-y-2 font-sans">
                      <div className="flex items-center justify-between bg-indigo-50/70 p-2.5 rounded border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🧬</span>
                          <span className="font-bold text-xs text-indigo-900">
                            Extracted {cell.extractedFeatures.length} Feature Signals (Mutual Information Selection)
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedFeaturesCell(expandedFeaturesCell === cell.id ? null : cell.id)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
                        >
                          {expandedFeaturesCell === cell.id ? "Hide Features List ▲" : `Show All ${cell.extractedFeatures.length} Features ▼`}
                        </button>
                      </div>

                      {/* Feature Grid */}
                      {expandedFeaturesCell === cell.id && (
                        <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 max-h-60 overflow-y-auto">
                          <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between border-b border-slate-200 pb-1">
                            <span>Feature Name & Type</span>
                            <span>Index</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                            {cell.extractedFeatures.map((feat, fIdx) => (
                              <div key={feat} className="flex items-center justify-between px-2 py-1 bg-white rounded border border-slate-200 text-[11px] font-mono shadow-2xs">
                                <span className="text-slate-800 font-medium truncate" title={feat}>
                                  {feat}
                                </span>
                                <span className="text-[10px] text-indigo-600 font-bold ml-1">
                                  #{fIdx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Clusters Information Output Cell */}
                  {cell.clusters && cell.clusters.length > 0 && (
                    <div className="mt-2 space-y-2 font-sans">
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                        <span>📊 Cluster Segment Analysis ({cell.clusters.length} clusters identified)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {cell.clusters.map((c: any, cIdx: number) => (
                          <div key={cIdx} className="p-2.5 bg-white rounded-md border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-800">{c.cluster_name || `Cluster #${cIdx + 1}`}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.risk_score > 0.5 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                Risk: {roundVal(c.risk_score ?? 0.1)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                              <span>Members: {c.count ?? "—"}</span>
                              <span>Rule: {c.rule_name || "Baseline"}</span>
                            </div>
                            {c.assignment_rationale && (
                              <p className="text-[10px] text-slate-500 font-sans italic border-t border-slate-100 pt-1 mt-1">
                                {c.assignment_rationale}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Model Evaluation Predictions & Metrics Cell */}
                  {cell.type === "complete" && cell.results && (
                    <div className="mt-3 space-y-3 font-sans">
                      {/* Summary Metrics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        <MetricBadge label="Records Scored" value={recCount} color="text-slate-800" />
                        <MetricBadge label="Fraud Flagged" value={fraudCount} color="text-rose-600" />
                        <MetricBadge label="Precision" value={`${(precision * 100).toFixed(1)}%`} color="text-indigo-600" />
                        <MetricBadge label="Recall" value={`${(recall * 100).toFixed(1)}%`} color="text-emerald-600" />
                        <MetricBadge label="F1 Score" value={`${(f1 * 100).toFixed(1)}%`} color="text-sky-600" />
                        <MetricBadge label="Fit Time" value={`${execTime}s`} color="text-amber-600" />
                      </div>

                      {/* Sample Flagged Rows Preview */}
                      {cell.results.flagged_rows && cell.results.flagged_rows.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-700">Flagged Risk Transactions Preview:</div>
                          <div className="overflow-x-auto border border-slate-200 rounded-md">
                            <table className="w-full text-left text-[11px] font-mono">
                              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                                <tr>
                                  <th className="px-2 py-1">Transaction ID</th>
                                  <th className="px-2 py-1">Amount</th>
                                  <th className="px-2 py-1">Risk Score</th>
                                  <th className="px-2 py-1">Tier</th>
                                  <th className="px-2 py-1">Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {cell.results.flagged_rows.slice(0, 4).map((r: any, rIdx: number) => (
                                  <tr key={rIdx} className="hover:bg-slate-50">
                                    <td className="px-2 py-1 text-slate-800">{r.transaction_id}</td>
                                    <td className="px-2 py-1 font-bold text-slate-900">${r.amount}</td>
                                    <td className="px-2 py-1 text-rose-600 font-bold">{r.score}</td>
                                    <td className="px-2 py-1">
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                        {r.risk_tier || "HIGH"}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-slate-600 text-[10px] truncate max-w-[200px]" title={r.fraud_reason}>
                                      {r.fraud_reason}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Artifacts List Cell */}
                  {cell.type === "artifacts" && cell.artifacts && (
                    <div className="mt-2 flex flex-wrap gap-1.5 font-mono">
                      {cell.artifacts.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold shadow-2xs">
                          📦 {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTraining && (
          <div className="flex gap-2 items-center text-slate-500 font-mono text-xs pl-16">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            <span className="font-semibold text-indigo-700">Fitting machine learning models & serializing .joblib artifacts...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MetricBadge({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="p-2 bg-slate-50 rounded-md border border-slate-200 text-center">
      <div className={`text-sm font-bold font-mono ${color}`}>{value ?? "—"}</div>
      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function roundVal(v: number) {
  return Math.round(v * 100) / 100;
}

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center max-w-sm px-6">
        <div className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-white border border-slate-200 text-indigo-600 shadow-sm">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" />
            <path d="M8 7.5L11 16M16 7.5L13 16M8 6h8" />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-700">Drag a node from the palette</p>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Build your fraud detection pipeline, select your dataset, then click <span className="text-indigo-600 font-bold">⚡ Train & Save</span> to fit models and view live Jupyter Notebook telemetry.
        </p>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}