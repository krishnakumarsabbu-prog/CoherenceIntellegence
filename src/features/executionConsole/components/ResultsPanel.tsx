import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExecutionResults } from "../types";

interface Props {
  results: ExecutionResults;
}

type ChartTab = "distribution" | "flagged-over-time";

export default function ResultsPanel({ results }: Props) {
  const { summary } = results;
  const [chartTab, setChartTab] = useState<ChartTab>("distribution");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const paged = useMemo(
    () => results.flagged_rows.slice(page * pageSize, (page + 1) * pageSize),
    [results.flagged_rows, page],
  );
  const totalPages = Math.max(1, Math.ceil(results.flagged_rows.length / pageSize));

  const metrics = [
    { label: "Fraud Cases Flagged", value: String(summary.flagged), accent: true },
    { label: "Precision", value: `${(summary.precision * 100).toFixed(1)}%` },
    { label: "Recall", value: `${(summary.recall * 100).toFixed(1)}%` },
    { label: "F1 Score", value: summary.f1.toFixed(3) },
    { label: "False Positive Rate", value: `${(summary.false_positive_rate * 100).toFixed(2)}%` },
    { label: "Total Execution Time", value: summary.execution_time_seconds != null ? `${summary.execution_time_seconds.toFixed(1)}s` : "—" },
  ];

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`glass-card p-4 ${m.accent ? "border-accent-200" : ""}`}>
            <p className="text-[11px] font-medium text-canvas-500 uppercase tracking-wide">{m.label}</p>
            <p className={`mt-1.5 text-xl font-semibold tracking-tight ${m.accent ? "text-accent-700" : "text-canvas-900"}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-canvas-800">Detection Analytics</h3>
          <div className="flex gap-1">
            <TabButton active={chartTab === "distribution"} onClick={() => setChartTab("distribution")}>
              Score Distribution
            </TabButton>
            <TabButton active={chartTab === "flagged-over-time"} onClick={() => setChartTab("flagged-over-time")}>
              Flagged Over Time
            </TabButton>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {chartTab === "distribution" ? (
              <BarChart data={results.score_distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                <Tooltip cursor={{ fill: "#F4F6F8" }} />
                <Bar dataKey="count" fill="#2E5AAC" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={results.flagged_over_time} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                <Tooltip cursor={{ stroke: "#A9B0BD" }} />
                <Line type="monotone" dataKey="flagged" stroke="#0D9488" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Results table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-canvas-800">Flagged Transactions</h3>
          <span className="text-xs text-canvas-400">{results.flagged_rows.length} flagged</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-canvas-400 uppercase tracking-wide bg-canvas-50/60">
                <th className="px-4 py-2.5 font-medium">Transaction ID</th>
                <th className="px-4 py-2.5 font-medium text-right">Score</th>
                <th className="px-4 py-2.5 font-medium text-center">Flagged</th>
                <th className="px-4 py-2.5 font-medium">Flagged By</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Country</th>
                <th className="px-4 py-2.5 font-medium text-center">Actual Fraud</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-canvas-400 italic">
                    No transactions were flagged.
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.transaction_id} className="border-t border-canvas-100 hover:bg-canvas-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-canvas-800">{r.transaction_id}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-canvas-700">{r.score.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`badge ${r.flagged === "Y" ? "bg-rose-50 text-rose-700" : "bg-canvas-100 text-canvas-600"}`}>
                        {r.flagged}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-canvas-600">{r.flagged_by}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-canvas-700">{r.amount.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-canvas-600">{r.country}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`badge ${r.is_fraud ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.is_fraud ? "Y" : "N"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-canvas-100 flex items-center justify-end gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-ghost text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-canvas-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-ghost text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
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
