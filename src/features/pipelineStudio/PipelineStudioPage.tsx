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
                ✕
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
            ↻ Sync DB
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
            ⚡
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
                    <span>•</span>
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
                      Studio 🎨
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunPipeline(pipe);
                      }}
                      className="btn-primary text-xs !py-1 !px-2.5 shadow-sm font-semibold"
                    >
                      Run ⚡
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

  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const id = usePipelineStore.getState().selectedNodeId;
        if (id) {
          e.preventDefault();
          deleteNode(id);
        }
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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const defType = e.dataTransfer.getData("application/x-pipeline-node");
      if (!defType || !wrapperRef.current || !rfInstance) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      addNodeFromCatalog(defType, {
        x: position.x - 94,
        y: position.y - 30,
      });
    },
    [rfInstance, addNodeFromCatalog],
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: { id: string }) => {
      e.preventDefault();
      selectNode(node.id);
      setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 lg:-m-8 border-y border-canvas-200 bg-canvas-50">
      <NodePalette
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed((v) => !v)}
        onDragStart={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <CanvasToolbar
          rfInstance={rfInstance}
          onValidate={validate}
          onBackToDashboard={onBackToDashboard}
        />

        {paletteCollapsed && (
          <button
            onClick={() => setPaletteCollapsed(false)}
            className="absolute left-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-canvas-200 shadow-card rounded-md"
            title="Show palette"
            aria-label="Show palette"
          >
            <ChevronIcon className="w-4 h-4" />
          </button>
        )}

        <div className="relative flex-1" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            onNodeClick={(_e, node) => selectNode(node.id)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
              style: { stroke: "#A9B0BD", strokeWidth: 1.6 },
            }}
            className="bg-canvas-50"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.4}
              color="#D3D8E0"
            />
            <Controls
              showInteractive={false}
              className="!shadow-card !rounded-md !border !border-canvas-200"
            />
            {showMinimap && (
              <MiniMap
                pannable
                zoomable
                className="!bg-white !border !border-canvas-200 !rounded-md !shadow-card"
                nodeColor={(n) => {
                  const cat = (n.data as { category?: NodeCategory })
                    ?.category;
                  return cat ? CATEGORY_META[cat]?.accent ?? "#A9B0BD" : "#A9B0BD";
                }}
                maskColor="rgba(247,248,250,0.6)"
              />
            )}
          </ReactFlow>

          {nodes.length === 0 && <EmptyCanvas />}

          <ToastStack />
        </div>
      </div>

      <PropertiesPanel
        collapsed={propsCollapsed}
        onToggle={() => setPropsCollapsed((v) => !v)}
      />

      {propsCollapsed && (
        <button
          onClick={() => setPropsCollapsed(false)}
          className="absolute right-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-canvas-200 shadow-card rounded-md"
          title="Show properties"
          aria-label="Show properties"
        >
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      )}

      <NodeContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-xl bg-white border border-canvas-200 text-canvas-400 shadow-card">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <path d="M8 7.5L11 16M16 7.5L13 16M8 6h8" />
          </svg>
        </div>
        <p className="text-sm font-medium text-canvas-600">
          Drag a node from the palette
        </p>
        <p className="text-xs text-canvas-400 mt-1 leading-relaxed">
          Compose your fraud-detection pipeline by dragging stages onto the
          canvas and wiring them together.
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
