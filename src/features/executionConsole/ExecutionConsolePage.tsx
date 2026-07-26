import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePipelineStore } from "../pipelineStudio/pipelineStore";
import type { SavedPipeline } from "../pipelineStudio/types";
import { useExecutionStore } from "./executionStore";
import { uploadDataset } from "./api";
import LivePipelineGraph from "./components/LivePipelineGraph";
import LogPanel from "./components/LogPanel";
import ResultsPanel from "./components/ResultsPanel";

export default function ExecutionConsolePage() {
  const savedPipelines = usePipelineStore((s) => s.savedPipelines);
  const loadSampleDataset = useExecutionStore((s) => s.loadSampleDataset);
  const sampleDataset = useExecutionStore((s) => s.sampleDataset);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSampleDataset();
  }, [loadSampleDataset]);

  // Default to the sample dataset once loaded.
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
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">Execution Console</h1>
        <p className="text-sm text-canvas-500 mt-1">
          Run a saved pipeline against a transaction dataset and watch detection progress live.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
        {/* Left: pipeline list + dataset selector */}
        <div className="space-y-4">
          <PipelineList
            pipelines={savedPipelines}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
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

        {/* Center + right: live graph, log, results */}
        <div className="space-y-4 min-w-0">
          <LiveView selected={selected} datasetRef={datasetRef} />
        </div>
      </div>
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
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100">
        <h2 className="text-sm font-semibold text-canvas-800">Saved Pipelines</h2>
        <p className="text-xs text-canvas-400 mt-0.5">{pipelines.length} available</p>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-canvas-100">
        {pipelines.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-canvas-400">
            No saved pipelines yet. Build and save one in Pipeline Studio.
          </div>
        ) : (
          pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                selectedId === p.id ? "bg-accent-50" : "hover:bg-canvas-50"
              }`}
            >
              <p className={`text-sm font-medium truncate ${selectedId === p.id ? "text-accent-700" : "text-canvas-800"}`}>
                {p.name}
              </p>
              <p className="text-[11px] text-canvas-400 mt-0.5">
                {p.nodes.length} nodes · {p.edges.length} edges
              </p>
            </button>
          ))
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
      <div className="px-4 py-3 border-b border-canvas-100">
        <h2 className="text-sm font-semibold text-canvas-800">Dataset</h2>
        <p className="text-xs text-canvas-400 mt-0.5">Input transactions to score</p>
      </div>
      <div className="p-4 space-y-2">
        <button
          onClick={onPickSample}
          disabled={!sampleDataset}
          className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors text-sm ${
            usingSample
              ? "border-accent-300 bg-accent-50 text-accent-700"
              : "border-canvas-200 hover:bg-canvas-50 text-canvas-700"
          }`}
        >
          <span className="font-medium">Sample dataset</span>
          <span className="block text-[11px] text-canvas-400 mt-0.5">
            {sampleDataset ? `${sampleDataset.row_count} rows (bundled)` : "loading…"}
          </span>
        </button>
        <div className="border-t border-canvas-100 pt-2">
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
            className="btn-ghost w-full text-xs justify-center"
          >
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          {uploadName && !usingSample && (
            <p className="text-[11px] text-canvas-500 mt-1.5 truncate">Using: {uploadName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveView({
  selected,
  datasetRef,
}: {
  selected: SavedPipeline | null;
  datasetRef: string | null;
}) {
  const run = useExecutionStore((s) => s.run);
  const reset = useExecutionStore((s) => s.reset);
  const status = useExecutionStore((s) => s.status);
  const results = useExecutionStore((s) => s.results);
  const error = useExecutionStore((s) => s.error);
  const execNodes = useExecutionStore((s) => s.nodes);

  const canRun = selected != null && datasetRef != null && status !== "running" && status !== "starting";

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="glass-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-canvas-800 truncate">
            {selected ? selected.name : "No pipeline selected"}
          </p>
          <p className="text-xs text-canvas-400 mt-0.5">
            {selected ? `${selected.nodes.length} nodes · ${selected.edges.length} edges` : "Pick one from the list"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-canvas-500 capitalize">{status}</span>
          {status === "running" || status === "starting" ? (
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
            </span>
          ) : status === "completed" ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          ) : status === "failed" ? (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          ) : null}
          {results && (
            <button onClick={reset} className="btn-ghost text-xs">
              Reset
            </button>
          )}
          <button
            onClick={() => selected && datasetRef && run(selected, datasetRef)}
            disabled={!canRun}
            className="btn-primary text-xs"
          >
            Run Pipeline
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Live graph */}
      <div className="glass-card overflow-hidden h-[340px]">
        <LivePipelineGraph
          nodes={selected?.nodes ?? []}
          edges={selected?.edges ?? []}
          progress={execNodes}
        />
      </div>

      {/* Log + results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[320px]">
          <LogPanel />
        </div>
        <div className="min-w-0">
          {results ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <ResultsPanel results={results} />
            </motion.div>
          ) : (
            <div className="glass-card h-full grid place-items-center text-center text-sm text-canvas-400">
              Results will appear here once execution completes.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
