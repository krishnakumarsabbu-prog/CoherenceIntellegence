import { useEffect, useMemo, useRef, useState } from "react";
import { useComparisonStore } from "../comparisonStore";
import type { PipelineProgress } from "../types";

interface ConsoleCell {
  id: string;
  type: "header" | "start" | "log" | "node" | "complete" | "artifacts" | "error";
  content: string;
  sub?: string;
  ts: string;
  status: "running" | "ok" | "error";
  pipelineId: string;
  pipelineName: string;
  pipelineColor: string;
  progress?: PipelineProgress;
}

const PIPE_COLORS = ["#2E5AAC", "#0D9488", "#D97706"];

export default function ComparisonJupyterConsole({
  open,
  height,
  onClose,
  onResize,
}: {
  open: boolean;
  height: number;
  onClose: () => void;
  onResize: (h: number) => void;
}) {
  const progress = useComparisonStore((s) => s.progress);
  const status = useComparisonStore((s) => s.status);
  const results = useComparisonStore((s) => s.results);

  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const cells = useMemo<ConsoleCell[]>(() => {
    const out: ConsoleCell[] = [];
    const pipelines = Object.values(progress).sort((a, b) => a.index - b.index);

    if (status === "running") {
      out.push({
        id: "header",
        type: "header",
        content: "Multi-Pipeline Comparison In Progress",
        ts: new Date().toISOString(),
        status: "running",
        pipelineId: "",
        pipelineName: "",
        pipelineColor: "#334155",
      });
    } else if (status === "completed" && results) {
      out.push({
        id: "header",
        type: "header",
        content: "Multi-Pipeline Comparison Complete",
        ts: new Date().toISOString(),
        status: "ok",
        pipelineId: "",
        pipelineName: "",
        pipelineColor: "#334155",
      });
    }

    for (const p of pipelines) {
      const color = PIPE_COLORS[p.index % PIPE_COLORS.length];
      out.push({
        id: `start-${p.pipeline_id}`,
        type: "start",
        content: `Pipeline ${p.index + 1}: ${p.pipeline_name}`,
        sub: p.startedAt ? `Started at ${p.startedAt.slice(11, 19)}` : undefined,
        ts: p.startedAt ?? new Date().toISOString(),
        status: p.status === "failed" ? "error" : "ok",
        pipelineId: p.pipeline_id,
        pipelineName: p.pipeline_name,
        pipelineColor: color,
        progress: p,
      });

      if (p.total_artifacts > 0) {
        out.push({
          id: `artifacts-${p.pipeline_id}`,
          type: "artifacts",
          content: `Loaded ${p.joblib_count} model artifact(s) + ${p.rule_count} rule config(s)`,
          sub: `${p.total_artifacts} total artifacts for ${p.pipeline_name}`,
          ts: p.startedAt ?? new Date().toISOString(),
          status: "ok",
          pipelineId: p.pipeline_id,
          pipelineName: p.pipeline_name,
          pipelineColor: color,
          progress: p,
        });
      }

      for (const log of p.logs) {
        const isNodeEvent =
          log.message.includes("Scored") ||
          log.message.includes("Cleaned") ||
          log.message.includes("Loaded") ||
          log.message.includes("Extracted") ||
          log.message.includes("Clustered") ||
          log.message.includes("Fitted") ||
          log.message.includes("Detected");
        out.push({
          id: log.id,
          type: log.level === "error" ? "error" : isNodeEvent ? "node" : "log",
          content: log.message,
          sub: p.pipeline_name,
          ts: log.ts,
          status: log.level === "error" ? "error" : "ok",
          pipelineId: p.pipeline_id,
          pipelineName: p.pipeline_name,
          pipelineColor: color,
        });
      }

      if (p.summary) {
        const s = p.summary;
        out.push({
          id: `complete-${p.pipeline_id}`,
          type: "complete",
          content: `${p.pipeline_name} - Execution Complete`,
          sub: `${s.total_transactions} records | ${s.flagged} flagged | P: ${(s.precision * 100).toFixed(1)}% | R: ${(s.recall * 100).toFixed(1)}% | F1: ${s.f1.toFixed(3)}`,
          ts: p.completedAt ?? new Date().toISOString(),
          status: "ok",
          pipelineId: p.pipeline_id,
          pipelineName: p.pipeline_name,
          pipelineColor: color,
          progress: p,
        });
      }
    }

    return out;
  }, [progress, status, results]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cells.length]);

  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startH: height };
    const move = (ev: MouseEvent) => {
      if (dragRef.current) onResize(dragRef.current.startH - (ev.clientY - dragRef.current.startY));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!open) return null;

  const isBusy = status === "running";

  return (
    <div
      className="flex-shrink-0 border-t border-slate-300 bg-white shadow-2xl flex flex-col font-sans"
      style={{ height }}
    >
      <div
        onMouseDown={handleDragStart}
        className="h-2 bg-slate-200 hover:bg-blue-500 cursor-row-resize transition-colors group flex items-center justify-center"
        title="Drag to resize console"
      >
        <div className="w-12 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors" />
      </div>

      <div className="flex items-center justify-between px-4 h-9 bg-slate-100 border-b border-slate-200 shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-200 border border-slate-300 text-slate-700 font-mono font-semibold text-[11px]">
            <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
            Jupyter Notebook Console
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isBusy ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-400"
              }`}
            />
            <span className="text-slate-600 font-medium">
              {isBusy ? "Kernel Busy (Comparing Pipelines...)" : "Kernel Idle"}
            </span>
          </div>
          {cells.length > 0 && (
            <span className="text-[11px] text-slate-500 font-mono">- {cells.length} executed cell(s)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-all"
            title="Close Console"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[#f8fafc] font-mono text-xs p-4 space-y-4 flex-1">
        {cells.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-12">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Awaiting Comparison Run...</span>
            <p className="text-[11px] text-slate-400 font-sans">
              Select 2-3 pipelines and a dataset, then run the comparison to view live Jupyter Notebook telemetry cells.
            </p>
          </div>
        )}

        {cells.map((cell, idx) => (
          <CellRenderer
            key={cell.id + idx}
            cell={cell}
            cellNum={idx + 1}
            isExpanded={expandedCell === cell.id}
            onToggle={() => setExpandedCell(expandedCell === cell.id ? null : cell.id)}
          />
        ))}

        {isBusy && (
          <div className="flex gap-2 items-center text-slate-500 font-mono text-xs pl-16">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span className="font-semibold text-blue-700">Executing pipeline nodes & streaming telemetry...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function CellRenderer({
  cell,
  cellNum,
  isExpanded,
  onToggle,
}: {
  cell: ConsoleCell;
  cellNum: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const summary = cell.progress?.summary;
  const artifacts = cell.progress?.artifacts ?? [];
  const joblibFiles = artifacts.filter((a) => a.name.endsWith(".joblib"));
  const ruleFiles = artifacts.filter((a) => a.name.endsWith(".json"));
  const nodes = cell.progress?.nodes ?? [];

  return (
    <div className="flex gap-2 items-start font-mono group">
      <div className="w-16 shrink-0 text-right text-[11px] font-bold select-none pt-1">
        <span className="text-[#000080]">In [{cellNum}]:</span>
      </div>

      <div
        className="flex-1 bg-white border rounded-lg shadow-sm overflow-hidden"
        style={{ borderColor: cell.pipelineColor + "40", borderLeftWidth: 3, borderLeftColor: cell.pipelineColor }}
      >
        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 font-sans font-medium text-slate-700">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
              style={{ background: cell.pipelineColor + "15", color: cell.pipelineColor, border: `1px solid ${cell.pipelineColor}40` }}
            >
              {cell.type}
            </span>
            <span>{cell.content}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{cell.ts.slice(11, 19)}</span>
        </div>

        <div className="p-3 font-mono text-xs text-slate-800 space-y-2">
          {cell.sub && (
            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 font-sans">
              {cell.sub}
            </div>
          )}

          {cell.type === "artifacts" && artifacts.length > 0 && (
            <div className="space-y-2 font-sans">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md bg-violet-50 border border-violet-200 text-center">
                  <div className="text-lg font-black text-violet-700">{joblibFiles.length}</div>
                  <div className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">Joblib Models</div>
                </div>
                <div className="p-2 rounded-md bg-blue-50 border border-blue-200 text-center">
                  <div className="text-lg font-black text-blue-700">{ruleFiles.length}</div>
                  <div className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">Rule Configs</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {artifacts.map((a) => (
                  <span
                    key={a.name}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${
                      a.name.endsWith(".joblib")
                        ? "bg-violet-50 text-violet-700 border-violet-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                    title={`${(a.size_bytes / 1024).toFixed(1)} KB`}
                  >
                    {a.name.endsWith(".joblib") && <span className="text-violet-400">[model]</span>}
                    {a.name.endsWith(".json") && <span className="text-blue-400">[rules]</span>}
                    {a.name}
                    <span className="text-slate-400 font-mono">({(a.size_bytes / 1024).toFixed(1)}KB)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {cell.type === "complete" && summary && (
            <div className="mt-3 space-y-3 font-sans">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <MetricBadge label="Records" value={summary.total_transactions} color="text-slate-800" />
                <MetricBadge label="Flagged" value={summary.flagged} color="text-rose-600" />
                <MetricBadge label="Precision" value={`${(summary.precision * 100).toFixed(1)}%`} color="text-blue-600" />
                <MetricBadge label="Recall" value={`${(summary.recall * 100).toFixed(1)}%`} color="text-amber-600" />
                <MetricBadge label="F1" value={summary.f1.toFixed(3)} color="text-violet-600" />
                <MetricBadge label="FPR" value={`${(summary.false_positive_rate * 100).toFixed(2)}%`} color="text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <ConfusionCell label="True Positives" value={summary.true_positives} color="text-emerald-700 bg-emerald-50 border-emerald-200" />
                <ConfusionCell label="False Positives" value={summary.false_positives} color="text-amber-700 bg-amber-50 border-amber-200" />
                <ConfusionCell label="False Negatives" value={summary.false_negatives} color="text-rose-700 bg-rose-50 border-rose-200" />
                <ConfusionCell label="True Negatives" value={summary.true_negatives} color="text-slate-700 bg-slate-50 border-slate-200" />
              </div>
              {nodes.length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={onToggle}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    {isExpanded ? "Hide Node Detail" : `Show Node Detail (${nodes.length} nodes)`}
                  </button>
                  {isExpanded && (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5 max-h-60 overflow-y-auto">
                      {nodes.map((n) => (
                        <div key={n.id} className="flex items-center gap-2 text-[11px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              n.status === "complete" ? "bg-emerald-500" : n.status === "running" ? "bg-amber-500 animate-pulse" : "bg-slate-300"
                            }`}
                          />
                          <span className="font-bold text-slate-800">{n.label}</span>
                          <span className="text-slate-500 font-mono">[{n.category}]</span>
                          <span className="text-slate-400">{n.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
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

function ConfusionCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`p-2.5 rounded-lg border text-center ${color}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl font-black mt-0.5">{value}</div>
    </div>
  );
}
