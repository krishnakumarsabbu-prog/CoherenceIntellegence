import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePipelineStore } from "../pipelineStudio/pipelineStore";
import type { SavedPipeline } from "../pipelineStudio/types";
import { useExecutionStore } from "../executionConsole/executionStore";
import { uploadDataset } from "../executionConsole/api";
import { useComparisonStore } from "./comparisonStore";
import ComparisonJupyterConsole from "./components/ComparisonJupyterConsole";
import ComparisonCoherenceBrain from "./components/ComparisonCoherenceBrain";
import ModelLoadingPanel from "./components/ModelLoadingPanel";
import MetricsComparison from "./components/MetricsComparison";

const MIN_SELECT = 2;
const MAX_SELECT = 3;
const PIPE_COLORS = ["#2E5AAC", "#0D9488", "#D97706"];

export default function PipelineComparisonPage() {
  const savedPipelines = usePipelineStore((s) => s.savedPipelines);
  const fetchPipelinesFromDb = usePipelineStore((s) => s.fetchPipelinesFromDb);
  const loadSampleDataset = useExecutionStore((s) => s.loadSampleDataset);
  const sampleDataset = useExecutionStore((s) => s.sampleDataset);

  const status = useComparisonStore((s) => s.status);
  const progress = useComparisonStore((s) => s.progress);
  const results = useComparisonStore((s) => s.results);
  const error = useComparisonStore((s) => s.error);
  const runComparison = useComparisonStore((s) => s.run);
  const resetComparison = useComparisonStore((s) => s.reset);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(320);

  useEffect(() => {
    fetchPipelinesFromDb();
    loadSampleDataset();
  }, [fetchPipelinesFromDb, loadSampleDataset]);

  useEffect(() => {
    if (savedPipelines.length >= 2 && selectedIds.length === 0) {
      setSelectedIds(savedPipelines.slice(0, 3).map((p) => p.id));
    } else if (savedPipelines.length === 1 && selectedIds.length === 0) {
      setSelectedIds([savedPipelines[0].id]);
    }
  }, [savedPipelines, selectedIds]);

  useEffect(() => {
    if (sampleDataset && !datasetRef) setDatasetRef(sampleDataset.id);
  }, [sampleDataset, datasetRef]);

  const togglePipeline = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, id];
    });
  };

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

  const handleRun = async () => {
    const picked = savedPipelines.filter((p) => selectedIds.includes(p.id));
    if (picked.length < MIN_SELECT || !datasetRef) return;
    resetComparison();
    setConsoleOpen(true);
    await runComparison(
      picked.map((p) => ({ id: p.id, name: p.name, nodes: p.nodes, edges: p.edges })),
      datasetRef,
    );
  };

  const canRun = selectedIds.length >= MIN_SELECT && datasetRef != null && status !== "running";
  const usingSample = sampleDataset != null && datasetRef === sampleDataset.id;
  const isRunning = status === "running";
  const hasResults = results != null && results.length > 0;
  const validResults = results?.filter((r) => r.summary && !r.error) ?? [];

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-[360px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Pipeline Comparison Studio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run 2-3 saved pipelines against the same dataset and compare detection metrics, model artifacts, and mathematical coherence side by side.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Left: selection + dataset */}
        <div className="space-y-4">
          <PipelinePicker
            pipelines={savedPipelines}
            selectedIds={selectedIds}
            onToggle={togglePipeline}
          />
          <DatasetCard
            sampleDataset={sampleDataset}
            usingSample={usingSample}
            onPickSample={() => {
              setDatasetRef(sampleDataset?.id ?? null);
              setUploadName(null);
            }}
            uploading={uploading}
            uploadName={uploadName}
            fileRef={fileRef}
            onUpload={handleUpload}
          />
          <button
            onClick={handleRun}
            disabled={!canRun}
            className={`w-full text-sm justify-center rounded-lg px-4 py-2.5 font-semibold transition-all ${
              canRun
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running comparison...
              </span>
            ) : (
              "Run Comparison"
            )}
          </button>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {/* Console toggle */}
          <button
            onClick={() => setConsoleOpen((o) => !o)}
            className="w-full text-xs justify-center rounded-lg px-4 py-2 font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
            {consoleOpen ? "Hide" : "Show"} Jupyter Console
          </button>
        </div>

        {/* Right: results */}
        <div className="min-w-0 space-y-4">
          {/* Live progress cards while running */}
          {isRunning && Object.keys(progress).length > 0 && (
            <LiveProgressGrid progress={progress} />
          )}

          {/* Model loading panel */}
          {(isRunning || hasResults) && Object.keys(progress).length > 0 && (
            <ModelLoadingPanel />
          )}

          {/* Empty state */}
          {!isRunning && !hasResults && (
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm h-[420px] grid place-items-center text-center">
              <div className="max-w-sm space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 grid place-items-center mx-auto mb-3 border border-blue-100">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">No comparison yet</p>
                <p className="text-xs text-gray-400">
                  Select {MIN_SELECT}-{MAX_SELECT} pipelines and a dataset, then run the comparison.
                  Results, model artifacts, and the Coherence Brain analysis appear here once all pipelines finish.
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && validResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Error rows */}
              {results!.some((r) => r.error) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
                  {results!.filter((r) => r.error).map((r) => `${r.pipeline_name}: ${r.error}`).join(" . ")}
                </div>
              )}

              {/* Side-by-side summary cards */}
              <div className={`grid gap-3 ${validResults.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                {validResults.map((r, i) => (
                  <ComparisonCard key={r.pipeline_id} result={r} accent={PIPE_COLORS[i % PIPE_COLORS.length]} />
                ))}
              </div>

              {/* Metrics comparison */}
              <MetricsComparison results={results!} />

              {/* Coherence Brain */}
              <ComparisonCoherenceBrain results={results!} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Jupyter Console - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <ComparisonJupyterConsole
          open={consoleOpen}
          height={consoleHeight}
          onClose={() => setConsoleOpen(false)}
          onResize={setConsoleHeight}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function PipelinePicker({
  pipelines,
  selectedIds,
  onToggle,
}: {
  pipelines: SavedPipeline[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Pipelines</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {selectedIds.length}/{MAX_SELECT} selected . need at least {MIN_SELECT}
        </p>
      </div>
      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
        {pipelines.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            No saved pipelines. Build and save one in Pipeline Studio first.
          </div>
        ) : (
          pipelines.map((p) => {
            const checked = selectedIds.includes(p.id);
            const disabled = !checked && selectedIds.length >= MAX_SELECT;
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                disabled={disabled}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                  checked ? "bg-blue-50" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    checked ? "bg-blue-500 border-blue-500" : "border-gray-300"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <p className={`text-sm font-medium truncate ${checked ? "text-blue-700" : "text-gray-800"}`}>
                    {p.name}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.nodes.length} nodes . {p.edges.length} edges
                  </p>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function DatasetCard({
  sampleDataset,
  usingSample,
  onPickSample,
  uploading,
  uploadName,
  fileRef,
  onUpload,
}: {
  sampleDataset: { id: string; name: string; row_count: number } | null;
  usingSample: boolean;
  onPickSample: () => void;
  uploading: boolean;
  uploadName: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Dataset</h2>
        <p className="text-xs text-gray-400 mt-0.5">Shared input for all pipelines</p>
      </div>
      <div className="p-4 space-y-2">
        <button
          onClick={onPickSample}
          disabled={!sampleDataset}
          className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors text-sm ${
            usingSample
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 hover:bg-gray-50 text-gray-700"
          }`}
        >
          <span className="font-medium">Sample dataset</span>
          <span className="block text-[11px] text-gray-400 mt-0.5">
            {sampleDataset ? `${sampleDataset.row_count} rows (bundled)` : "loading..."}
          </span>
        </button>
        <div className="border-t border-gray-100 pt-2">
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
            className="w-full text-xs justify-center rounded-md px-3 py-2 font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>
          {uploadName && !usingSample && (
            <p className="text-[11px] text-gray-500 mt-1.5 truncate">Using: {uploadName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveProgressGrid({ progress }: { progress: Record<string, any> }) {
  const pipelines = Object.values(progress).sort((a, b) => a.index - b.index);
  return (
    <div className={`grid gap-3 ${pipelines.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {pipelines.map((p, i) => (
        <LiveProgressCard key={p.pipeline_id} progress={p} accent={PIPE_COLORS[i % PIPE_COLORS.length]} />
      ))}
    </div>
  );
}

function LiveProgressCard({ progress, accent }: { progress: any; accent: string }) {
  const completedNodes = progress.nodes.filter((n: any) => n.status === "complete").length;
  const totalNodes = progress.nodes.length;
  const pct = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

  return (
    <div
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
      style={{ borderTopWidth: 3, borderTopColor: accent }}
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="text-sm font-semibold text-gray-800 truncate flex-1">{progress.pipeline_name}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
          progress.status === "complete" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700 animate-pulse"
        }`}>
          {progress.status === "complete" ? "DONE" : `${pct}%`}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: accent }}
          />
        </div>
        {/* Node pills */}
        {progress.nodes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {progress.nodes.map((n: any) => (
              <span
                key={n.id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
                  n.status === "complete"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : n.status === "running"
                      ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                      : "bg-gray-50 text-gray-400 border border-gray-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  n.status === "complete" ? "bg-emerald-500" : n.status === "running" ? "bg-amber-500" : "bg-gray-300"
                }`} />
                {n.label}
              </span>
            ))}
          </div>
        )}
        {/* Summary if complete */}
        {progress.summary && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <Stat label="Flagged" value={progress.summary.flagged} />
            <Stat label="F1" value={progress.summary.f1.toFixed(3)} />
            <Stat label="FPR" value={`${(progress.summary.false_positive_rate * 100).toFixed(2)}%`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-gray-800">{value}</div>
      <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ComparisonCard({ result, accent }: { result: any; accent: string }) {
  const s = result.summary;
  const acc = s.true_positives + s.true_negatives > 0
    ? (s.true_positives + s.true_negatives) / s.total_transactions
    : 0;
  const metrics = [
    { label: "Accuracy", value: `${(acc * 100).toFixed(1)}%` },
    { label: "Precision", value: `${(s.precision * 100).toFixed(1)}%` },
    { label: "Recall", value: `${(s.recall * 100).toFixed(1)}%` },
    { label: "F1 Score", value: s.f1.toFixed(3), highlight: true },
    { label: "False Positive Rate", value: `${(s.false_positive_rate * 100).toFixed(2)}%` },
    { label: "Fraud Cases Flagged", value: String(s.flagged) },
    { label: "True Positives", value: String(s.true_positives) },
    { label: "False Positives", value: String(s.false_positives) },
    { label: "Execution Time", value: s.execution_time_seconds != null ? `${s.execution_time_seconds.toFixed(1)}s` : "--" },
  ];
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="text-sm font-semibold text-gray-800 truncate">{result.pipeline_name}</h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={m.highlight ? "col-span-2" : ""}>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className={`mt-1 ${m.highlight ? "text-2xl" : "text-lg"} font-semibold tracking-tight ${m.highlight ? "text-blue-700" : "text-gray-900"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
