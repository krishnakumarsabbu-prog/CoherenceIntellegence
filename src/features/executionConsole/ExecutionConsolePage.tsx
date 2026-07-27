import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePipelineStore } from "../pipelineStudio/pipelineStore";
import type { SavedPipeline } from "../pipelineStudio/types";
import { useExecutionStore } from "./executionStore";
import { uploadDataset } from "./api";
import LivePipelineGraph from "./components/LivePipelineGraph";
import LogPanel from "./components/LogPanel";
import ResultsPanel from "./components/ResultsPanel";
import NodeDetailModal from "./components/NodeDetailModal";
import SuggestedOptimizations from "./components/SuggestedOptimizations";

export default function ExecutionConsolePage() {
  const savedPipelines = usePipelineStore((s) => s.savedPipelines);
  const fetchPipelinesFromDb = usePipelineStore((s) => s.fetchPipelinesFromDb);
  const loadSampleDataset = useExecutionStore((s) => s.loadSampleDataset);
  const sampleDataset = useExecutionStore((s) => s.sampleDataset);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPipelinesFromDb();
    loadSampleDataset();
  }, [fetchPipelinesFromDb, loadSampleDataset]);

  useEffect(() => {
    if (savedPipelines.length > 0 && !selectedId) {
      setSelectedId(savedPipelines[0].id);
    }
  }, [savedPipelines, selectedId]);

  useEffect(() => {
    if (sampleDataset && !datasetRef) setDatasetRef(sampleDataset.id);
  }, [sampleDataset, datasetRef]);

  const selected = useMemo(
    () => savedPipelines.find((p) => p.id === selectedId) ?? null,
    [savedPipelines, selectedId],
  );

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ds = await uploadDataset(file);
      setDatasetRef(ds.id);
      setUploadName(ds.name);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans pb-10">
      {/* Executive Light Command Header */}
      <div className="p-5 rounded-2xl bg-white border border-canvas-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-50 text-accent-600 border border-accent-200 grid place-items-center text-2xl shadow-xs">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-50 text-accent-700 border border-accent-200">
                COHERENCE IQ · PRODUCTION ENGINE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-canvas-100 text-canvas-700">
                v4.2 ENTERPRISE TELEMETRY
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-canvas-900">Execution Console</h1>
            <p className="text-xs text-canvas-500 mt-0.5">
              Run saved pipeline architectures against transaction feeds and observe explainable AI fraud detection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DatasetBadge datasetRef={datasetRef} uploadName={uploadName} sampleDataset={sampleDataset} />
          <RunButton selected={selected} datasetRef={datasetRef} />
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Main View */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        {/* Left Sidebar */}
        <div className="space-y-5">
          <PipelineList pipelines={savedPipelines} selectedId={selectedId} onSelect={setSelectedId} />
          <DatasetSelector
            sampleDataset={sampleDataset}
            datasetRef={datasetRef}
            onPickSample={() => {
              setDatasetRef(sampleDataset?.id ?? null);
              setUploadName(null);
            }}
            uploading={uploading}
            uploadName={uploadName}
            fileRef={fileRef}
            onUpload={handleUpload}
          />
        </div>

        {/* Main View */}
        <div className="space-y-6 min-w-0">
          <LiveView selected={selected} />
        </div>
      </div>
    </div>
  );
}

function RunButton({ selected, datasetRef }: { selected: SavedPipeline | null; datasetRef: string | null }) {
  const run = useExecutionStore((s) => s.run);
  const reset = useExecutionStore((s) => s.reset);
  const status = useExecutionStore((s) => s.status);
  const results = useExecutionStore((s) => s.results);

  const canRun = selected != null && datasetRef != null && status !== "running" && status !== "starting";
  const isRunning = status === "running" || status === "starting";

  return (
    <div className="flex items-center gap-2">
      {results && !isRunning && (
        <button
          onClick={reset}
          className="btn-ghost text-xs font-medium"
        >
          Reset
        </button>
      )}
      <button
        onClick={() => selected && datasetRef && run(selected, datasetRef)}
        disabled={!canRun}
        className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all shadow-sm flex items-center gap-2 ${
          isRunning
            ? "bg-amber-500 text-white animate-pulse"
            : canRun
            ? "bg-accent-600 hover:bg-accent-700 text-white active:scale-98 shadow-md"
            : "bg-canvas-100 text-canvas-400 cursor-not-allowed border border-canvas-200"
        }`}
      >
        {isRunning ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>Executing Pipeline…</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>Run Enterprise Pipeline</span>
          </>
        )}
      </button>
    </div>
  );
}

function DatasetBadge({
  datasetRef,
  uploadName,
  sampleDataset,
}: {
  datasetRef: string | null;
  uploadName: string | null;
  sampleDataset: any;
}) {
  const isSample = sampleDataset && datasetRef === sampleDataset.id;
  return (
    <div className="bg-canvas-50 border border-canvas-200 rounded-xl px-3.5 py-2 font-mono text-xs hidden md:flex flex-col">
      <span className="text-[9px] text-canvas-400 uppercase font-bold">Active Dataset Target</span>
      <span className="text-canvas-800 font-bold mt-0.5 truncate max-w-[180px]">
        {isSample ? `📊 Sample (${sampleDataset.row_count} rows)` : uploadName ? `📄 ${uploadName}` : "No Dataset"}
      </span>
    </div>
  );
}

function PipelineList({
  pipelines,
  selectedId,
  onSelect,
}: {
  pipelines: SavedPipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="glass-card overflow-hidden space-y-1">
      <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between bg-canvas-50/50">
        <h2 className="text-xs font-bold text-canvas-700 uppercase tracking-wider font-mono">Saved Pipelines</h2>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-50 text-accent-700 border border-accent-200">
          {pipelines.length} READY
        </span>
      </div>
      <div className="max-h-[380px] overflow-y-auto divide-y divide-canvas-100 p-1.5 space-y-1">
        {pipelines.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-canvas-400">
            No saved pipelines. Build and save one in Pipeline Studio.
          </div>
        ) : (
          pipelines.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`w-full text-left p-3 rounded-xl transition-all relative ${
                  isSelected
                    ? "bg-accent-50/80 border border-accent-200 text-accent-900 font-semibold shadow-xs"
                    : "hover:bg-canvas-50 text-canvas-700 border border-transparent"
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-accent-600 rounded-r-full" />
                )}
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold truncate ${isSelected ? "text-accent-800" : "text-canvas-800"}`}>
                    {p.name}
                  </p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-canvas-500 border border-canvas-200">
                    {p.nodes.length} N
                  </span>
                </div>
                <p className="text-[10px] text-canvas-400 mt-1 font-mono">
                  {p.nodes.length} processing nodes · {p.edges.length} flow edges
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function DatasetSelector({
  sampleDataset,
  datasetRef,
  onPickSample,
  uploading,
  uploadName,
  fileRef,
  onUpload,
}: {
  sampleDataset: { id: string; name: string; row_count: number } | null;
  datasetRef: string | null;
  onPickSample: () => void;
  uploading: boolean;
  uploadName: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
}) {
  const usingSample = sampleDataset != null && datasetRef === sampleDataset.id;
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between bg-canvas-50/50">
        <h2 className="text-xs font-bold text-canvas-700 uppercase tracking-wider font-mono">Transaction Feed</h2>
        <span className="text-[10px] font-mono text-canvas-400">CSV FEED</span>
      </div>
      <div className="p-4 space-y-3">
        <button
          onClick={onPickSample}
          disabled={!sampleDataset}
          className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-mono ${
            usingSample
              ? "border-accent-300 bg-accent-50/70 text-accent-800 font-semibold shadow-xs"
              : "border-canvas-200 bg-white text-canvas-700 hover:bg-canvas-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-canvas-800">Standard Fraud Feed</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white text-accent-700 border border-accent-200">BUNDLED</span>
          </div>
          <span className="block text-[10px] text-canvas-400 mt-1">
            {sampleDataset ? `${sampleDataset.row_count} transaction records` : "loading feed…"}
          </span>
        </button>

        <div className="pt-1">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-ghost w-full justify-center text-xs font-semibold py-2.5 rounded-xl border border-canvas-200 bg-white"
          >
            <span>📥</span>
            <span>{uploading ? "Uploading Data Feed…" : "Upload Custom CSV"}</span>
          </button>
          {uploadName && !usingSample && (
            <p className="text-[10px] font-mono text-accent-700 mt-2 truncate">Active: {uploadName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveView({
  selected,
}: {
  selected: SavedPipeline | null;
}) {
  const results = useExecutionStore((s) => s.results);
  const error = useExecutionStore((s) => s.error);
  const execNodes = useExecutionStore((s) => s.nodes);

  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const inspectedNodeObj = selected?.nodes.find((n) => n.id === inspectedNodeId);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-mono font-bold">
          ⚠️ Execution Error: {error}
        </div>
      )}

      {/* Live Graph Canvas */}
      <div className="glass-card overflow-hidden h-[380px] relative border border-slate-200">
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-[11px] text-canvas-600 flex items-center gap-2 shadow-xs">
          <span>🔍</span>
          <span>Click any node card to launch high-fidelity record attribution & cluster telemetry inspector.</span>
        </div>
        <LivePipelineGraph
          nodes={selected?.nodes ?? []}
          edges={selected?.edges ?? []}
          progress={execNodes}
          onNodeClick={(id) => setInspectedNodeId(id)}
        />
      </div>

      {/* Node Detail Modal Inspector */}
      {inspectedNodeId && (
        <NodeDetailModal
          nodeId={inspectedNodeId}
          nodeLabel={inspectedNodeObj?.data?.label}
          telemetry={(results?.node_telemetry as any)?.[inspectedNodeId]}
          onClose={() => setInspectedNodeId(null)}
        />
      )}

      {/* Telemetry Stream + Results Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Log Stream Terminal */}
        <div className="lg:col-span-5 h-[520px]">
          <LogPanel />
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 min-w-0">
          {results ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
              <ResultsPanel results={results} />
              {selected && (
                <SuggestedOptimizations
                  pipeline={{
                    id: selected.id,
                    name: selected.name,
                    nodes: selected.nodes,
                    edges: selected.edges,
                  }}
                  summary={results.summary}
                />
              )}
            </motion.div>
          ) : (
            <div className="glass-card h-[520px] grid place-items-center text-center p-8 text-canvas-400 font-mono text-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-canvas-100 flex items-center justify-center text-3xl">📊</div>
              <div>
                <p className="text-sm font-bold text-canvas-800">Execution Results Dashboard Idle</p>
                <p className="text-xs text-canvas-500 mt-1 max-w-sm">
                  Select an enterprise pipeline and click "Run Enterprise Pipeline" to generate explainable telemetry.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
