import { useEffect, useMemo, useRef, useState } from "react";
import { useExecutionStore } from "../executionStore";
import type { ExecutionResults } from "../types";

interface ConsoleCell {
  id: string;
  type: "header" | "start" | "log" | "warn" | "error" | "node" | "complete" | "artifacts";
  content: string;
  sub?: string;
  ts: string;
  status: "running" | "ok" | "error";
  nodeId?: string;
  results?: ExecutionResults;
}

export default function JupyterConsole({
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
  const logs = useExecutionStore((s) => s.logs);
  const nodes = useExecutionStore((s) => s.nodes);
  const results = useExecutionStore((s) => s.results);
  const status = useExecutionStore((s) => s.status);

  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const cells = useMemo<ConsoleCell[]>(() => {
    const out: ConsoleCell[] = [];

    if (status === "starting" || status === "running") {
      out.push({
        id: "header",
        type: "header",
        content: `Pipeline Execution In Progress`,
        ts: new Date().toISOString(),
        status: "running",
      });
    } else if (status === "completed" && results) {
      out.push({
        id: "header",
        type: "header",
        content: `Pipeline Execution Complete`,
        ts: new Date().toISOString(),
        status: "ok",
      });
    }

    for (const log of logs) {
      const nodeLabel = nodes.find((n) => n.id === log.node_id)?.label ?? log.node_id;
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
        sub: nodeLabel ? `Node: ${nodeLabel}` : undefined,
        ts: log.ts,
        status: "ok",
        nodeId: log.node_id ?? undefined,
      });
    }

    if (results) {
      const s = results.summary;
      out.push({
        id: "complete",
        type: "complete",
        content: "Pipeline Analysis Complete - All Models Evaluated",
        sub: `${s.total_transactions} records scored | ${s.flagged} flagged | Precision: ${(s.precision * 100).toFixed(1)}% | Recall: ${(s.recall * 100).toFixed(1)}% | F1: ${s.f1.toFixed(3)}`,
        ts: new Date().toISOString(),
        status: "ok",
        results,
      });

      if (results.detection_nodes && results.detection_nodes.length > 0) {
        out.push({
          id: "artifacts",
          type: "artifacts",
          content: `${results.detection_nodes.length} Detection Models Executed`,
          ts: new Date().toISOString(),
          status: "ok",
        });
      }
    }

    return out;
  }, [logs, nodes, results, status]);

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

  const isBusy = status === "running" || status === "starting";

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
              {isBusy ? "Kernel Busy (Executing...)" : "Kernel Idle"}
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
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Awaiting Execution Run...</span>
            <p className="text-[11px] text-slate-400 font-sans">
              Click Run Analysis to execute the pipeline and view live Jupyter Notebook telemetry cells.
            </p>
          </div>
        )}

        {cells.map((cell, idx) => {
          const cellNum = idx + 1;
          return (
            <CellRenderer
              key={cell.id + idx}
              cell={cell}
              cellNum={cellNum}
              isExpanded={expandedCell === cell.id}
              onToggle={() => setExpandedCell(expandedCell === cell.id ? null : cell.id)}
            />
          );
        })}

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
  const summary = cell.results?.summary;
  const detectionNodes = cell.results?.detection_nodes ?? [];
  const flaggedRows = cell.results?.flagged_rows ?? [];
  const scoreDist = cell.results?.score_distribution ?? [];
  const ruleClusters = cell.results?.rule_clusters ?? [];
  const nodeTelemetry = cell.results?.node_telemetry ?? {};

  return (
    <div className="flex gap-2 items-start font-mono group">
      <div className="w-16 shrink-0 text-right text-[11px] font-bold select-none pt-1">
        <span className="text-[#000080]">In [{cellNum}]:</span>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 font-sans font-medium text-slate-700">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                cell.type === "error"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : cell.type === "complete"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : cell.type === "node"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : cell.type === "artifacts"
                  ? "bg-violet-50 text-violet-700 border border-violet-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
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

          {cell.type === "complete" && summary && (
            <div className="mt-3 space-y-3 font-sans">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <MetricBadge label="Records Scored" value={summary.total_transactions} color="text-slate-800" />
                <MetricBadge label="Fraud Flagged" value={summary.flagged} color="text-rose-600" />
                <MetricBadge
                  label="Precision"
                  value={`${(summary.precision * 100).toFixed(1)}%`}
                  color="text-blue-600"
                />
                <MetricBadge
                  label="Recall"
                  value={`${(summary.recall * 100).toFixed(1)}%`}
                  color="text-amber-600"
                />
                <MetricBadge label="F1 Score" value={summary.f1.toFixed(3)} color="text-violet-600" />
                <MetricBadge
                  label="FPR"
                  value={`${(summary.false_positive_rate * 100).toFixed(2)}%`}
                  color="text-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <ConfusionCell label="True Positives" value={summary.true_positives} color="text-emerald-700 bg-emerald-50 border-emerald-200" />
                <ConfusionCell label="False Positives" value={summary.false_positives} color="text-amber-700 bg-amber-50 border-amber-200" />
                <ConfusionCell label="False Negatives" value={summary.false_negatives} color="text-rose-700 bg-rose-50 border-rose-200" />
                <ConfusionCell label="True Negatives" value={summary.true_negatives} color="text-slate-700 bg-slate-50 border-slate-200" />
              </div>

              {detectionNodes.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">Detection Models Executed:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectionNodes.map((dn) => (
                      <span
                        key={dn.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold"
                      >
                        {dn.label}
                        {dn.algorithm && <span className="text-blue-400 font-mono">({dn.algorithm})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {scoreDist.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">Score Distribution:</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {scoreDist.map((b) => {
                      const maxCount = Math.max(...scoreDist.map((x) => x.count), 1);
                      const pct = Math.round((b.count / maxCount) * 100);
                      return (
                        <div key={b.bucket} className="bg-slate-50 rounded border border-slate-200 p-1.5 text-center">
                          <div className="text-[9px] text-slate-500 font-mono">{b.bucket}</div>
                          <div className="text-sm font-bold text-slate-800">{b.count}</div>
                          <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.keys(nodeTelemetry).length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={onToggle}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    {isExpanded ? "Hide Node Telemetry Detail" : "Show Node Telemetry Detail"}
                  </button>
                  {isExpanded && (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 max-h-60 overflow-y-auto">
                      {Object.entries(nodeTelemetry).map(([nid, tel]: [string, any]) => (
                        <div key={nid} className="p-2 bg-white rounded border border-slate-200 text-[11px]">
                          <div className="font-bold text-slate-800">{tel.label || nid}</div>
                          <div className="text-slate-500 font-mono">{tel.algorithm || "N/A"}</div>
                          <div className="flex gap-3 mt-1 text-[10px]">
                            <span>In: {tel.inflow_count ?? "—"}</span>
                            <span>Out: {tel.outflow_count ?? "—"}</span>
                            <span>Latency: {tel.execution_time_ms ?? "—"}ms</span>
                          </div>
                          {tel.details?.feature_importances?.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              <div className="text-[9px] font-bold text-slate-500 uppercase">Top Features:</div>
                              {tel.details.feature_importances.slice(0, 3).map((f: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-slate-700 font-mono">{f.feature}</span>
                                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500 rounded-full"
                                      style={{ width: `${Math.round(f.importance * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-amber-700 font-bold text-[10px]">
                                    {Math.round(f.importance * 100)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {tel.details?.clusters?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {tel.details.clusters.map((c: any, ci: number) => (
                                <span
                                  key={ci}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    c.risk_score > 0.5
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {c.cluster_name}: {c.count} recs
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {flaggedRows.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">Top Flagged Transactions:</div>
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-2 py-1">Transaction ID</th>
                          <th className="px-2 py-1">Amount</th>
                          <th className="px-2 py-1">Score</th>
                          <th className="px-2 py-1">Tier</th>
                          <th className="px-2 py-1">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {flaggedRows.slice(0, 5).map((r, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            <td className="px-2 py-1 text-slate-800">{r.transaction_id}</td>
                            <td className="px-2 py-1 font-bold text-slate-900">${Number(r.amount || 0).toFixed(2)}</td>
                            <td className="px-2 py-1 text-rose-600 font-bold">{r.score.toFixed(4)}</td>
                            <td className="px-2 py-1">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  r.risk_tier === "CRITICAL"
                                    ? "bg-rose-100 text-rose-800"
                                    : r.risk_tier === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-indigo-100 text-indigo-800"
                                }`}
                              >
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

              {ruleClusters.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-700">
                    Rule-to-Cluster Mappings ({ruleClusters.length} rules mapped):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ruleClusters.slice(0, 8).map((rc) => (
                      <span
                        key={rc.rule_id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold"
                      >
                        {rc.rule_id} {"->"} {rc.cluster_label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {cell.type === "artifacts" && detectionNodes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono">
              {detectionNodes.map((dn) => (
                <span
                  key={dn.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold shadow-xs"
                >
                  {dn.label} {dn.algorithm && `(${dn.algorithm})`}
                </span>
              ))}
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
