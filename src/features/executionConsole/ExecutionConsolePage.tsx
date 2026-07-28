import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePipelineStore } from "../pipelineStudio/pipelineStore";
import type { SavedPipeline } from "../pipelineStudio/types";
import { useExecutionStore } from "./executionStore";
import { uploadDataset } from "./api";
import LivePipelineGraph from "./components/LivePipelineGraph";
import LogPanel from "./components/LogPanel";
import ResultsPanel from "./components/ResultsPanel";
import NodeDetailModal from "./components/NodeDetailModal";
import SuggestedOptimizations from "./components/SuggestedOptimizations";
import {
  MetricCard,
  MetricCardSkeleton,
  ExecutionChart,
  SecondaryCharts,
  HistoricalTable,
  ActivityFeed,
  buildSpark,
  buildFlaggedSpark,
} from "./components/AnalyticsSections";
import type { DatasetInfo } from "./types";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export default function ExecutionConsolePage() {
  const savedPipelines = usePipelineStore((s) => s.savedPipelines);
  const fetchPipelinesFromDb = usePipelineStore((s) => s.fetchPipelinesFromDb);
  const loadSampleDataset = useExecutionStore((s) => s.loadSampleDataset);
  const sampleDataset = useExecutionStore((s) => s.sampleDataset);
  const run = useExecutionStore((s) => s.run);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [showJsonModal, setShowJsonModal] = useState(false);
  const [customPayload, setCustomPayload] = useState<Record<string, any> | null>(null);
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(
      {
        amount: 75000,
        country: "IN",
        ip_country: "RU",
        tx_freq_1h: 12,
        geo_velocity: 180,
        device_risk_score: 85,
        new_device: true,
        is_blacklisted: false,
      },
      null,
      2,
    ),
  );

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
      setCustomPayload(null);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  const handleApplyAndRunJson = (parsedPayload: Record<string, any>) => {
    setCustomPayload(parsedPayload);
    setDatasetRef("custom-json-payload");
    setUploadName("Single Payload (JSON)");
    if (selected) {
      run(selected, "custom-json-payload", parsedPayload);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-[1600px] mx-auto font-sans pb-12 space-y-6"
    >
      <HeroHeader
        selected={selected}
        savedPipelines={savedPipelines}
        selectedId={selectedId}
        onSelectPipeline={setSelectedId}
        datasetRef={datasetRef}
        uploadName={uploadName}
        sampleDataset={sampleDataset}
        customPayload={customPayload}
        onUpload={handleUpload}
        uploading={uploading}
        fileRef={fileRef}
        onPickSample={() => {
          setDatasetRef(sampleDataset?.id ?? null);
          setUploadName(null);
          setCustomPayload(null);
        }}
        onOpenJsonModal={() => setShowJsonModal(true)}
      />

      <KpiRow />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <AnalyticsDashboard selected={selected} />
        </div>
        <div className="space-y-6">
          <ActivityFeedSection
            savedPipelines={savedPipelines}
            selectedId={selectedId}
            onSelectPipeline={setSelectedId}
          />
        </div>
      </div>

      <HistoricalTableSection />

      <LiveExecutionSection selected={selected} />

      <JsonPayloadModal
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        jsonInput={jsonInput}
        setJsonInput={setJsonInput}
        onApplyAndRun={handleApplyAndRunJson}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero Header                                                         */
/* ------------------------------------------------------------------ */

function HeroHeader({
  selected,
  savedPipelines,
  selectedId,
  onSelectPipeline,
  datasetRef,
  uploadName,
  sampleDataset,
  customPayload,
  onUpload,
  uploading,
  fileRef,
  onPickSample,
  onOpenJsonModal,
}: {
  selected: SavedPipeline | null;
  savedPipelines: SavedPipeline[];
  selectedId: string | null;
  onSelectPipeline: (id: string) => void;
  datasetRef: string | null;
  uploadName: string | null;
  sampleDataset: DatasetInfo | null;
  customPayload: Record<string, any> | null;
  onUpload: (file: File) => void;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
  onPickSample: () => void;
  onOpenJsonModal: () => void;
}) {
  const status = useExecutionStore((s) => s.status);
  const isLive = status === "running" || status === "starting";

  return (
    <motion.div variants={itemVariants}>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-gray-200 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-violet-50" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px circle at 15% 20%, rgba(37,99,235,0.10), transparent 40%), radial-gradient(500px circle at 85% 80%, rgba(139,92,246,0.10), transparent 45%)",
          }}
        />

        <div className="relative p-6 md:p-7">
          <nav className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 mb-4">
            <span>CoherenceIQ</span>
            <span className="text-gray-300">/</span>
            <span>Pipeline Studio</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-semibold">Execution Console</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 transition-colors ${
                    isLive
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : status === "failed"
                      ? "bg-rose-50 text-rose-700 ring-rose-200"
                      : "bg-gray-50 text-gray-600 ring-gray-200"
                  }`}
                >
                  <span className="relative flex w-2 h-2">
                    {isLive && (
                      <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    )}
                    <span
                      className={`relative inline-flex w-2 h-2 rounded-full ${
                        isLive ? "bg-emerald-500" : status === "failed" ? "bg-rose-500" : "bg-gray-400"
                      }`}
                    />
                  </span>
                  {isLive ? "Live" : status === "failed" ? "Error" : status === "completed" ? "Completed" : "Idle"}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-white/70 text-gray-600 ring-1 ring-gray-200 backdrop-blur-sm">
                  v4.2 ENTERPRISE TELEMETRY
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  Execution Console
                </span>
              </h1>
              <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
                Run saved pipeline architectures against transaction feeds and observe explainable AI fraud detection in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <DatasetBadge
                datasetRef={datasetRef}
                uploadName={uploadName}
                sampleDataset={sampleDataset}
                customPayload={customPayload}
              />
              <RunButton selected={selected} datasetRef={datasetRef} customPayload={customPayload} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PipelinePicker
              pipelines={savedPipelines}
              selectedId={selectedId}
              onSelect={onSelectPipeline}
            />
            <DatasetQuickActions
              sampleDataset={sampleDataset}
              datasetRef={datasetRef}
              onPickSample={onPickSample}
              uploading={uploading}
              uploadName={uploadName}
              fileRef={fileRef}
              onUpload={onUpload}
              onOpenJsonModal={onOpenJsonModal}
              customPayload={customPayload}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RunButton({
  selected,
  datasetRef,
  customPayload,
}: {
  selected: SavedPipeline | null;
  datasetRef: string | null;
  customPayload: Record<string, any> | null;
}) {
  const run = useExecutionStore((s) => s.run);
  const reset = useExecutionStore((s) => s.reset);
  const status = useExecutionStore((s) => s.status);
  const results = useExecutionStore((s) => s.results);

  const canRun = selected != null && datasetRef != null && status !== "running" && status !== "starting";
  const isRunning = status === "running" || status === "starting";

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {results && !isRunning && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={reset}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-gray-700 ring-1 ring-gray-200 shadow-sm hover:bg-gray-50 transition-all"
          >
            Reset
          </motion.button>
        )}
      </AnimatePresence>
      <button
        onClick={() => selected && datasetRef && run(selected, datasetRef, customPayload)}
        disabled={!canRun}
        className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm flex items-center gap-2 ${
          isRunning
            ? "bg-amber-500 text-white animate-pulse"
            : canRun
            ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-md"
            : "bg-gray-100 text-gray-400 cursor-not-allowed ring-1 ring-gray-200"
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
            <span>Run Analysis</span>
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
  customPayload,
}: {
  datasetRef: string | null;
  uploadName: string | null;
  sampleDataset: DatasetInfo | null;
  customPayload: Record<string, any> | null;
}) {
  const isSample = sampleDataset != null && datasetRef === sampleDataset.id;
  const isCustomJson = datasetRef === "custom-json-payload" || customPayload != null;

  return (
    <div className="bg-white/80 backdrop-blur-sm ring-1 ring-gray-200 rounded-xl px-3.5 py-2 font-mono text-xs hidden md:flex flex-col shadow-sm">
      <span className="text-[9px] text-gray-400 uppercase font-bold">Active Dataset</span>
      <span className="text-gray-800 font-bold mt-0.5 truncate max-w-[190px]">
        {isCustomJson
          ? `📝 Custom Payload (1 row)`
          : isSample
          ? `📊 Sample (${sampleDataset?.row_count} rows)`
          : uploadName
          ? `📄 ${uploadName}`
          : "No Dataset"}
      </span>
    </div>
  );
}

function PipelinePicker({
  pipelines,
  selectedId,
  onSelect,
}: {
  pipelines: SavedPipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm ring-1 ring-gray-200 rounded-xl px-3 py-2 shadow-sm">
      <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">Pipeline</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none max-w-[180px] truncate"
      >
        {pipelines.length === 0 ? (
          <option value="">No saved pipelines</option>
        ) : (
          pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.nodes.length} nodes)
            </option>
          ))
        )}
      </select>
    </div>
  );
}

function DatasetQuickActions({
  sampleDataset,
  datasetRef,
  onPickSample,
  uploading,
  uploadName,
  fileRef,
  onUpload,
  onOpenJsonModal,
  customPayload,
}: {
  sampleDataset: DatasetInfo | null;
  datasetRef: string | null;
  onPickSample: () => void;
  uploading: boolean;
  uploadName: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
  onOpenJsonModal: () => void;
  customPayload: Record<string, any> | null;
}) {
  const usingSample = sampleDataset != null && datasetRef === sampleDataset.id;
  const usingCustomPayload = datasetRef === "custom-json-payload" || customPayload != null;

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={onPickSample}
        disabled={!sampleDataset}
        className={`px-3 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${
          usingSample
            ? "bg-blue-50 text-blue-700 ring-blue-200 font-bold"
            : "bg-white/80 backdrop-blur-sm text-gray-700 ring-gray-200 hover:bg-gray-50"
        }`}
      >
        📊 Sample Feed
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/80 backdrop-blur-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
      >
        {uploading ? "Uploading…" : "📥 Upload CSV"}
      </button>
      <button
        onClick={onOpenJsonModal}
        className={`px-3 py-2 rounded-xl text-xs font-bold ring-1 transition-all flex items-center gap-1.5 cursor-pointer ${
          usingCustomPayload
            ? "bg-purple-50 text-purple-700 ring-purple-300 shadow-xs font-bold"
            : "bg-white/80 backdrop-blur-sm text-gray-700 ring-gray-200 hover:bg-gray-50"
        }`}
      >
        <span>📝</span>
        <span>Single Payload (JSON)</span>
        {usingCustomPayload && (
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        )}
      </button>
      {uploadName && !usingSample && (
        <span className="text-[10px] font-mono text-purple-700 font-bold truncate max-w-[150px]">
          Active: {uploadName}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI Row                                                             */
/* ------------------------------------------------------------------ */

function KpiRow() {
  const results = useExecutionStore((s) => s.results);
  const status = useExecutionStore((s) => s.status);
  const nodes = useExecutionStore((s) => s.nodes);

  const loading = status === "idle" && !results;

  if (loading) {
    return (
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} index={i} />
        ))}
      </motion.div>
    );
  }

  const summary = results?.summary;
  const flaggedSpark = buildFlaggedSpark(results);

  const metrics = summary
    ? [
        {
          label: "Fraud Flagged",
          value: summary.flagged,
          icon: "⚠️",
          accent: "#EF4444",
          trend: summary.precision > 0.7 ? 8.4 : -2.1,
          spark: flaggedSpark,
        },
        {
          label: "Precision",
          value: summary.precision * 100,
          decimals: 1,
          suffix: "%",
          icon: "🎯",
          accent: "#2563EB",
          trend: 4.2,
          spark: buildSpark(summary.precision * 100),
        },
        {
          label: "Recall",
          value: summary.recall * 100,
          decimals: 1,
          suffix: "%",
          icon: "🔍",
          accent: "#F59E0B",
          trend: 3.1,
          spark: buildSpark(summary.recall * 100),
        },
        {
          label: "F1 Score",
          value: summary.f1,
          decimals: 3,
          icon: "📊",
          accent: "#8B5CF6",
          trend: 1.8,
          spark: buildSpark(summary.f1 * 100),
        },
      ]
    : [
        {
          label: "Nodes in Pipeline",
          value: nodes.length,
          icon: "🔗",
          accent: "#2563EB",
          trend: undefined,
          spark: buildSpark(nodes.length),
        },
        {
          label: "Completed Nodes",
          value: nodes.filter((n) => n.status === "complete").length,
          icon: "✅",
          accent: "#10B981",
          trend: undefined,
          spark: buildSpark(nodes.filter((n) => n.status === "complete").length),
        },
        {
          label: "Running Nodes",
          value: nodes.filter((n) => n.status === "running").length,
          icon: "⚡",
          accent: "#F59E0B",
          trend: undefined,
          spark: buildSpark(nodes.filter((n) => n.status === "running").length),
        },
        {
          label: "Pending Nodes",
          value: nodes.filter((n) => n.status === "pending").length,
          icon: "⏳",
          accent: "#8B5CF6",
          trend: undefined,
          spark: buildSpark(nodes.filter((n) => n.status === "pending").length),
        },
      ];

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <MetricCard key={m.label} index={i} {...m} />
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Analytics Dashboard (primary + secondary charts + results)        */
/* ------------------------------------------------------------------ */

function AnalyticsDashboard({ selected }: { selected: SavedPipeline | null }) {
  const results = useExecutionStore((s) => s.results);

  return (
    <motion.div variants={itemVariants} className="space-y-6">
      <ExecutionChart results={results} />
      <SecondaryCharts results={results} />

      <AnimatePresence mode="wait">
        {results ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <ResultsPanel results={results} />
            {selected && (
              <SuggestedOptimizations
                pipeline={{ id: selected.id, name: selected.name, nodes: selected.nodes, edges: selected.edges }}
                summary={results.summary}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm h-[420px] grid place-items-center text-center p-8"
          >
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 grid place-items-center text-3xl mx-auto">📊</div>
              <p className="text-sm font-bold text-gray-800">Execution Results Dashboard Idle</p>
              <p className="text-xs text-gray-500 max-w-sm">
                Select a pipeline and click "Run Analysis" to generate explainable telemetry and populate the analytics dashboard.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity Feed sidebar                                               */
/* ------------------------------------------------------------------ */

function ActivityFeedSection({
  savedPipelines,
  selectedId,
  onSelectPipeline,
}: {
  savedPipelines: SavedPipeline[];
  selectedId: string | null;
  onSelectPipeline: (id: string) => void;
}) {
  const logs = useExecutionStore((s) => s.logs);
  const status = useExecutionStore((s) => s.status);

  return (
    <motion.div variants={itemVariants} className="space-y-6">
      <ActivityFeed logs={logs} status={status} />
      <PipelineListCompact
        savedPipelines={savedPipelines}
        selectedId={selectedId}
        onSelectPipeline={onSelectPipeline}
      />
    </motion.div>
  );
}

function PipelineListCompact({
  savedPipelines,
  selectedId,
  onSelectPipeline,
}: {
  savedPipelines: SavedPipeline[];
  selectedId: string | null;
  onSelectPipeline: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Saved Pipelines</h3>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
          {savedPipelines.length} READY
        </span>
      </div>
      <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
        {savedPipelines.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400">
            No saved pipelines. Build and save one in Pipeline Studio.
          </div>
        ) : (
          savedPipelines.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPipeline(p.id)}
                className={`w-full text-left p-3 rounded-xl transition-all relative ${
                  isSelected
                    ? "bg-blue-50/80 ring-1 ring-blue-200 text-blue-900 font-semibold"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                {isSelected && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full" />}
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold truncate ${isSelected ? "text-blue-800" : "text-gray-800"}`}>{p.name}</p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-gray-500 ring-1 ring-gray-200">
                    {p.nodes.length}N
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                  {p.nodes.length} nodes · {p.edges.length} edges
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Historical Table section                                            */
/* ------------------------------------------------------------------ */

function HistoricalTableSection() {
  const results = useExecutionStore((s) => s.results);
  return (
    <motion.div variants={itemVariants}>
      <HistoricalTable results={results} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Live Execution section (graph + logs + node inspector)             */
/* ------------------------------------------------------------------ */

function LiveExecutionSection({ selected }: { selected: SavedPipeline | null }) {
  const error = useExecutionStore((s) => s.error);
  const execNodes = useExecutionStore((s) => s.nodes);
  const results = useExecutionStore((s) => s.results);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const inspectedNodeObj = selected?.nodes.find((n) => n.id === inspectedNodeId);

  const inspectedTelemetry = useMemo(() => {
    if (!inspectedNodeId || !results?.node_telemetry) return null;
    const tel = (results.node_telemetry as Record<string, unknown>)[inspectedNodeId];
    return (tel ?? null) as never;
  }, [inspectedNodeId, results]);

  return (
    <motion.div variants={itemVariants} className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Live Execution View</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl ring-1 ring-rose-200 bg-rose-50 text-rose-700 text-xs font-mono font-bold"
          >
            ⚠️ Execution Error: {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden h-[400px] relative">
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl ring-1 ring-gray-200 text-[11px] text-gray-600 flex items-center gap-2 shadow-sm">
          <span>🔍</span>
          <span>Click any node card to launch the record attribution & cluster telemetry inspector.</span>
        </div>
        <LivePipelineGraph
          nodes={selected?.nodes ?? []}
          edges={selected?.edges ?? []}
          progress={execNodes}
          onNodeClick={(id) => setInspectedNodeId(id)}
        />
      </div>

      <AnimatePresence>
        {inspectedNodeId && (
          <NodeDetailModal
            nodeId={inspectedNodeId}
            nodeLabel={inspectedNodeObj?.data?.label}
            telemetry={inspectedTelemetry}
            onClose={() => setInspectedNodeId(null)}
          />
        )}
      </AnimatePresence>

      <div className="h-[480px]">
        <LogPanel />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* JSON Payload Modal                                                  */
/* ------------------------------------------------------------------ */

function JsonPayloadModal({
  isOpen,
  onClose,
  jsonInput,
  setJsonInput,
  onApplyAndRun,
}: {
  isOpen: boolean;
  onClose: () => void;
  jsonInput: string;
  setJsonInput: (val: string) => void;
  onApplyAndRun: (parsedPayload: Record<string, any>) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      JSON.parse(jsonInput);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Invalid JSON syntax");
    }
  }, [jsonInput]);

  if (!isOpen) return null;

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      /* ignore */
    }
  };

  const handlePreset = (obj: Record<string, any>) => {
    setJsonInput(JSON.stringify(obj, null, 2));
    setError(null);
  };

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError("Payload must be a valid JSON object");
        return;
      }
      onApplyAndRun(parsed);
      onClose();
    } catch {
      setError("Please fix JSON syntax errors before submitting");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-2xl max-w-xl w-full p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 grid place-items-center font-bold text-lg border border-purple-200/60 shadow-xs">
                📝
              </span>
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">
                  Single Transaction Payload (JSON)
                </h3>
                <p className="text-xs text-gray-500">
                  Input custom JSON payload to evaluate directly on top of active ML pipeline artifacts.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors font-bold text-sm"
            >
              ✕
            </button>
          </div>

          {/* Quick Presets Bar */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              Quick Scenario Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  handlePreset({
                    amount: 45.2,
                    country: "US",
                    ip_country: "US",
                    tx_freq_1h: 1,
                    new_device: false,
                    is_blacklisted: false,
                  })
                }
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                💳 Legitimate ($45.20)
              </button>
              <button
                onClick={() =>
                  handlePreset({
                    amount: 95000,
                    country: "IN",
                    ip_country: "RU",
                    tx_freq_1h: 18,
                    geo_velocity: 340,
                    device_risk_score: 92,
                    new_device: true,
                    is_blacklisted: false,
                  })
                }
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                🚨 High-Velocity Fraud ($95k)
              </button>
              <button
                onClick={() =>
                  handlePreset({
                    amount: 150000,
                    country: "SG",
                    ip_country: "KP",
                    tx_freq_1h: 4,
                    is_blacklisted: true,
                  })
                }
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                ⛔ Sanction Hard Block ($150k)
              </button>
            </div>
          </div>

          {/* JSON Textarea Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-500 font-bold">JSON Payload Body</span>
              {error ? (
                <span className="text-rose-600 font-semibold text-[11px]">⚠️ {error}</span>
              ) : (
                <span className="text-emerald-600 font-semibold text-[11px]">✅ Valid JSON Object</span>
              )}
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={9}
              className={`w-full font-mono text-xs p-3.5 rounded-xl border outline-none transition-all shadow-inner leading-relaxed ${
                error
                  ? "bg-rose-50/50 border-rose-300 text-gray-900 focus:border-rose-500"
                  : "bg-slate-50 border-gray-200 text-gray-900 focus:bg-white focus:border-purple-500"
              }`}
              placeholder="Paste JSON object here..."
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              onClick={handleFormat}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              ✨ Format JSON
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={Boolean(error)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  error
                    ? "bg-gray-300 cursor-not-allowed shadow-none"
                    : "bg-purple-600 hover:bg-purple-700 active:scale-95 cursor-pointer"
                }`}
              >
                🚀 Apply & Run Analysis
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
