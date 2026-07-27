import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePipelineStore } from "../pipelineStudio/pipelineStore";
import type { SavedPipeline } from "../pipelineStudio/types";
import { useExecutionStore } from "../executionConsole/executionStore";
import { uploadDataset } from "../executionConsole/api";
import { runComparison } from "./api";
import type { ComparisonResult } from "./types";

type ChartMode = "bar" | "radar";
type SortMetric = "f1" | "precision" | "recall" | "false_positive_rate" | "flagged" | "execution_time_seconds";

const METRIC_LABELS: Record<SortMetric, string> = {
  f1: "F1 Score",
  precision: "Precision",
  recall: "Recall",
  false_positive_rate: "False Positive Rate",
  flagged: "Fraud Cases Flagged",
  execution_time_seconds: "Execution Time",
};

const MIN_SELECT = 2;
const MAX_SELECT = 3;

export default function PipelineComparisonPage() {
  const savedPipelines = usePipelineStore((s) => s.savedPipelines);
  const fetchPipelinesFromDb = usePipelineStore((s) => s.fetchPipelinesFromDb);
  const loadSampleDataset = useExecutionStore((s) => s.loadSampleDataset);
  const sampleDataset = useExecutionStore((s) => s.sampleDataset);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("radar");
  const [sortMetric, setSortMetric] = useState<SortMetric>("f1");

  useEffect(() => {
    fetchPipelinesFromDb();
    loadSampleDataset();
  }, [fetchPipelinesFromDb, loadSampleDataset]);

  // Auto-select pipelines from DB for comparison
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
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const { results } = await runComparison(
        picked.map((p) => ({
          id: p.id,
          name: p.name,
          nodes: p.nodes,
          edges: p.edges,
        })),
        datasetRef,
      );
      setResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const canRun = selectedIds.length >= MIN_SELECT && datasetRef != null && !running;
  const usingSample = sampleDataset != null && datasetRef === sampleDataset.id;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">Pipeline Comparison</h1>
        <p className="text-sm text-canvas-500 mt-1">
          Run 2–3 saved pipelines against the same dataset and compare detection metrics side by side.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
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
            className="btn-primary w-full text-sm justify-center"
          >
            {running ? "Running comparison…" : "Run Comparison"}
          </button>
          {error && (
            <div className="glass-card border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Right: results */}
        <div className="min-w-0 space-y-4">
          {results ? (
            <ComparisonResults
              results={results}
              chartMode={chartMode}
              setChartMode={setChartMode}
              sortMetric={sortMetric}
              setSortMetric={setSortMetric}
            />
          ) : (
            <div className="glass-card h-[420px] grid place-items-center text-center">
              <div className="max-w-sm space-y-2">
                <p className="text-sm font-medium text-canvas-700">No comparison yet</p>
                <p className="text-xs text-canvas-400">
                  Select {MIN_SELECT}–{MAX_SELECT} pipelines and a dataset, then run the comparison.
                  Results appear here once all pipelines finish.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100">
        <h2 className="text-sm font-semibold text-canvas-800">Pipelines</h2>
        <p className="text-xs text-canvas-400 mt-0.5">
          {selectedIds.length}/{MAX_SELECT} selected · need at least {MIN_SELECT}
        </p>
      </div>
      <div className="max-h-[360px] overflow-y-auto divide-y divide-canvas-100">
        {pipelines.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-canvas-400">
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
                  checked ? "bg-accent-50" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-canvas-50"
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    checked ? "bg-accent-500 border-accent-500" : "border-canvas-300"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0">
                  <p className={`text-sm font-medium truncate ${checked ? "text-accent-700" : "text-canvas-800"}`}>
                    {p.name}
                  </p>
                  <p className="text-[11px] text-canvas-400 mt-0.5">
                    {p.nodes.length} nodes · {p.edges.length} edges
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
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100">
        <h2 className="text-sm font-semibold text-canvas-800">Dataset</h2>
        <p className="text-xs text-canvas-400 mt-0.5">Shared input for all pipelines</p>
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

function ComparisonResults({
  results,
  chartMode,
  setChartMode,
  sortMetric,
  setSortMetric,
}: {
  results: ComparisonResult[];
  chartMode: ChartMode;
  setChartMode: (m: ChartMode) => void;
  sortMetric: SortMetric;
  setSortMetric: (m: SortMetric) => void;
}) {
  const valid = results.filter((r) => r.summary && !r.error);

  const ranked = useMemo(() => {
    const sorted = [...valid].sort((a, b) => {
      const av = (a.summary![sortMetric] as number) ?? 0;
      const bv = (b.summary![sortMetric] as number) ?? 0;
      // Lower is better for FPR and execution time.
      const lowerBetter = sortMetric === "false_positive_rate" || sortMetric === "execution_time_seconds";
      return lowerBetter ? av - bv : bv - av;
    });
    return sorted;
  }, [valid, sortMetric]);

  const chartData = useMemo(() => {
    const metrics: { key: string; label: string; pct: boolean }[] = [
      { key: "precision", label: "Precision", pct: true },
      { key: "recall", label: "Recall", pct: true },
      { key: "f1", label: "F1", pct: true },
      { key: "false_positive_rate", label: "FPR", pct: true },
    ];
    return metrics.map((m) => {
      const point: Record<string, unknown> = { metric: m.label };
      for (const r of valid) {
        const v = r.summary![m.key as keyof typeof r.summary] as number;
        point[r.pipeline_name] = m.pct ? +(v * 100).toFixed(1) : +v.toFixed(3);
      }
      return point;
    });
  }, [valid]);

  const barData = useMemo(() => {
    const metrics = [
      { key: "precision", label: "Precision", pct: true },
      { key: "recall", label: "Recall", pct: true },
      { key: "f1", label: "F1", pct: true },
      { key: "false_positive_rate", label: "FPR", pct: true },
    ];
    return metrics.map((m) => {
      const point: Record<string, unknown> = { metric: m.label };
      for (const r of valid) {
        const v = r.summary![m.key as keyof typeof r.summary] as number;
        point[r.pipeline_name] = m.pct ? +(v * 100).toFixed(1) : +v.toFixed(3);
      }
      return point;
    });
  }, [valid]);

  const colors = ["#2E5AAC", "#0D9488", "#D97706"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Error rows */}
      {results.some((r) => r.error) && (
        <div className="glass-card border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          {results.filter((r) => r.error).map((r) => `${r.pipeline_name}: ${r.error}`).join(" · ")}
        </div>
      )}

      {/* Side-by-side cards */}
      <div className={`grid gap-3 ${valid.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {valid.map((r, i) => (
          <ComparisonCard key={r.pipeline_id} result={r} accent={colors[i % colors.length]} />
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-canvas-800">Metric Comparison</h3>
          <div className="flex gap-1">
            <TabButton active={chartMode === "radar"} onClick={() => setChartMode("radar")}>
              Radar
            </TabButton>
            <TabButton active={chartMode === "bar"} onClick={() => setChartMode("bar")}>
              Grouped Bar
            </TabButton>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "radar" ? (
              <RadarChart data={chartData} margin={{ top: 16, right: 30, left: 30, bottom: 16 }}>
                <PolarGrid stroke="#E5E8ED" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#525968" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#A9B0BD" }} />
                {valid.map((r, i) => (
                  <Radar
                    key={r.pipeline_id}
                    name={r.pipeline_name}
                    dataKey={r.pipeline_name}
                    stroke={colors[i % colors.length]}
                    fill={colors[i % colors.length]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            ) : (
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: "#525968" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} unit="%" />
                <Tooltip cursor={{ fill: "#F4F6F8" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {valid.map((r, i) => (
                  <Bar key={r.pipeline_id} dataKey={r.pipeline_name} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-canvas-800">Leaderboard</h3>
          <label className="flex items-center gap-2 text-xs text-canvas-500">
            Sort by
            <select
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as SortMetric)}
              className="border border-canvas-200 rounded-md px-2 py-1 text-xs bg-white text-canvas-700 focus:outline-none focus:ring-1 focus:ring-accent-300"
            >
              {(Object.keys(METRIC_LABELS) as SortMetric[]).map((m) => (
                <option key={m} value={m}>{METRIC_LABELS[m]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-canvas-400 uppercase tracking-wide bg-canvas-50/60">
                <th className="px-4 py-2.5 font-medium">Rank</th>
                <th className="px-4 py-2.5 font-medium">Pipeline</th>
                <th className="px-4 py-2.5 font-medium text-right">Accuracy</th>
                <th className="px-4 py-2.5 font-medium text-right">Precision</th>
                <th className="px-4 py-2.5 font-medium text-right">Recall</th>
                <th className="px-4 py-2.5 font-medium text-right">F1</th>
                <th className="px-4 py-2.5 font-medium text-right">FPR</th>
                <th className="px-4 py-2.5 font-medium text-right">Flagged</th>
                <th className="px-4 py-2.5 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const s = r.summary!;
                const acc = s.true_positives + s.true_negatives > 0
                  ? (s.true_positives + s.true_negatives) / s.total_transactions
                  : 0;
                return (
                  <tr key={r.pipeline_id} className="border-t border-canvas-100 hover:bg-canvas-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold ${
                        i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-canvas-100 text-canvas-600" : "bg-canvas-50 text-canvas-500"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-canvas-800">{r.pipeline_name}</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">{(acc * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">{(s.precision * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">{(s.recall * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-canvas-800">{s.f1.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">{(s.false_positive_rate * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">{s.flagged}</td>
                    <td className="px-4 py-2.5 text-right text-canvas-600">
                      {s.execution_time_seconds != null ? `${s.execution_time_seconds.toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function ComparisonCard({ result, accent }: { result: ComparisonResult; accent: string }) {
  const s = result.summary!;
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
    { label: "Execution Time", value: s.execution_time_seconds != null ? `${s.execution_time_seconds.toFixed(1)}s` : "—" },
  ];
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100 flex items-center gap-2" style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="text-sm font-semibold text-canvas-800 truncate">{result.pipeline_name}</h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={m.highlight ? "col-span-2" : ""}>
            <p className="text-[11px] font-medium text-canvas-500 uppercase tracking-wide">{m.label}</p>
            <p className={`mt-1 ${m.highlight ? "text-2xl" : "text-lg"} font-semibold tracking-tight ${m.highlight ? "text-accent-700" : "text-canvas-900"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
        active ? "bg-accent-50 text-accent-700" : "text-canvas-500 hover:bg-canvas-100"
      }`}
    >
      {children}
    </button>
  );
}
