import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ExecutionResults } from "../types";

interface Props { results: ExecutionResults; }
type MainTab = "summary" | "fraud" | "charts" | "pipeline";

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
  HIGH:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  MEDIUM:   { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  LOW:      { bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200" },
};

export default function ResultsPanel({ results }: Props) {
  const { summary } = results;
  const [tab, setTab] = useState<MainTab>("summary");
  const [fraudPage, setFraudPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 10;

  const fraudRows = results.flagged_rows || [];
  const paged = useMemo(
    () => fraudRows.slice(fraudPage * pageSize, (fraudPage + 1) * pageSize),
    [fraudRows, fraudPage]
  );
  const totalPages = Math.max(1, Math.ceil(fraudRows.length / pageSize));

  const criticalCount = fraudRows.filter((r) => r.risk_tier === "CRITICAL").length;
  const highCount     = fraudRows.filter((r) => r.risk_tier === "HIGH").length;
  const medCount      = fraudRows.filter((r) => r.risk_tier === "MEDIUM").length;

  return (
    <div className="space-y-5">
      {/* Hero Light Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          accent
          label="Fraud Flagged"
          value={String(summary.flagged)}
          sub={`${criticalCount} Critical · ${highCount} High`}
          color="rose"
        />
        <KpiCard
          label="Precision"
          value={`${(summary.precision * 100).toFixed(1)}%`}
          sub="True Positives / Flagged"
          color="blue"
        />
        <KpiCard
          label="Recall"
          value={`${(summary.recall * 100).toFixed(1)}%`}
          sub="True Positives / Actual"
          color="amber"
        />
        <KpiCard
          label="F1 Score"
          value={summary.f1.toFixed(3)}
          sub="Harmonic mean P × R"
          color="violet"
        />
        <KpiCard
          label="False Pos. Rate"
          value={`${(summary.false_positive_rate * 100).toFixed(2)}%`}
          sub="FP / (FP + TN)"
          color="emerald"
        />
        <KpiCard
          label="Execution Time"
          value={summary.execution_time_seconds != null ? `${summary.execution_time_seconds.toFixed(2)}s` : "—"}
          sub={`${results.node_telemetry ? Object.keys(results.node_telemetry).length : "9"} nodes executed`}
          color="indigo"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        {(["summary", "fraud", "charts", "pipeline"] as MainTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all capitalize ${
              tab === t
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            {t === "summary"
              ? "📊 Executive Summary"
              : t === "fraud"
              ? `⚠️ Fraud Cases (${fraudRows.length})`
              : t === "charts"
              ? "📈 Telemetry & Distribution"
              : "🔗 Pipeline Node Deep-Dive"}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <SummaryTab
          summary={summary}
          results={results}
          criticalCount={criticalCount}
          highCount={highCount}
          medCount={medCount}
        />
      )}
      {tab === "fraud" && (
        <FraudTab
          paged={paged}
          fraudRows={fraudRows}
          fraudPage={fraudPage}
          setFraudPage={setFraudPage}
          totalPages={totalPages}
          expandedRow={expandedRow}
          setExpandedRow={setExpandedRow}
        />
      )}
      {tab === "charts" && <ChartsTab results={results} />}
      {tab === "pipeline" && <PipelineNodesTab results={results} />}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  accent?: boolean;
}) {
  const colorMap: Record<string, { val: string; bg: string; border: string }> = {
    rose:    { val: "text-rose-700 font-black",    bg: "bg-rose-50/70",    border: "border-rose-200" },
    blue:    { val: "text-blue-700 font-black",    bg: "bg-blue-50/70",    border: "border-blue-200" },
    amber:   { val: "text-amber-700 font-black",   bg: "bg-amber-50/70",   border: "border-amber-200" },
    violet:  { val: "text-violet-700 font-black",  bg: "bg-violet-50/70",  border: "border-violet-200" },
    emerald: { val: "text-emerald-700 font-black", bg: "bg-emerald-50/70", border: "border-emerald-200" },
    indigo:  { val: "text-indigo-700 font-black",  bg: "bg-indigo-50/70",  border: "border-indigo-200" },
  };

  const style = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`p-4 rounded-2xl bg-white border ${style.border} ${style.bg} shadow-xs flex flex-col justify-between ${accent ? "ring-2 ring-rose-300/40" : ""}`}
    >
      <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-2xl tracking-tight ${style.val}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1 font-mono">{sub}</p>}
    </div>
  );
}

function SummaryTab({ summary, results, criticalCount, highCount, medCount }: any) {
  return (
    <div className="space-y-5">
      {/* Confusion Matrix + Risk Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Confusion Matrix */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">Executive Confusion Matrix</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              CLASSIFICATION METRICS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "True Positives", v: summary.true_positives, c: "bg-emerald-50 border-emerald-200 text-emerald-800", sub: "Correct Fraud Flags" },
              { l: "False Positives", v: summary.false_positives, c: "bg-orange-50 border-orange-200 text-orange-800", sub: "Legitimate Flagged" },
              { l: "False Negatives", v: summary.false_negatives, c: "bg-rose-50 border-rose-200 text-rose-800", sub: "Missed Fraud Cases" },
              { l: "True Negatives", v: summary.true_negatives, c: "bg-slate-50 border-slate-200 text-slate-800", sub: "Correct Normal Clear" },
            ].map(({ l, v, c, sub }) => (
              <div key={l} className={`p-4 rounded-xl border ${c} text-center space-y-1`}>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">{l}</div>
                <div className="text-3xl font-black">{v}</div>
                <div className="text-[10px] opacity-70 font-mono">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Tier Classification */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">Risk Tier Classification Breakdown</h3>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {results.flagged_rows.length} TOTAL FLAGGED
            </span>
          </div>
          <div className="space-y-4">
            {[
              { t: "CRITICAL RISK (Score ≥ 0.85)", c: criticalCount, color: "bg-rose-500", text: "text-rose-700" },
              { t: "HIGH RISK (Score ≥ 0.65)", c: highCount, color: "bg-amber-500", text: "text-amber-700" },
              { t: "MEDIUM RISK (Score ≥ 0.45)", c: medCount, color: "bg-indigo-500", text: "text-indigo-700" },
            ].map(({ t, c, color, text }) => {
              const pct = results.flagged_rows.length ? Math.round((c / results.flagged_rows.length) * 100) : 0;
              return (
                <div key={t} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className={`font-bold ${text}`}>{t}</span>
                    <span className="text-slate-800 font-bold">{c} cases ({pct}%)</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rule-to-Cluster Neural Mapping */}
      {results.rule_clusters && results.rule_clusters.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                ⚡ Rule-to-Cluster Neural Mapping Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clustering model mapped {results.rule_clusters.length} uploaded Markdown rules into semantic parameter clusters
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {new Set(results.rule_clusters.map((c: any) => c.cluster_label)).size} CLUSTERS FORMED
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Rule ID</th>
                  <th className="px-4 py-3">Assigned Cluster</th>
                  <th className="px-4 py-3 text-center">Param Count</th>
                  <th className="px-4 py-3">Extracted Parameters</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {results.rule_clusters.map((rc: any) => (
                  <tr key={rc.rule_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-indigo-700">{rc.rule_id}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        📁 {rc.cluster_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">{rc.parameter_count}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{rc.parameters}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-sm truncate">{rc.rule_description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FraudTab({ paged, fraudRows, fraudPage, setFraudPage, totalPages, expandedRow, setExpandedRow }: any) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Flagged Fraud Intelligence & Case Drill-down</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click any row to expand multi-signal dynamic explanation</p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          {fraudRows.length} CASES FLAGGED
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Transaction ID</th>
              <th className="px-4 py-3 text-center">Risk Tier</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Flagged By</th>
              <th className="px-4 py-3 text-center">Actual Fraud</th>
              <th className="px-4 py-3">Primary Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {paged.map((r: any) => {
              const risk = r.risk_tier || "MEDIUM";
              const rc = RISK_COLORS[risk] || RISK_COLORS.MEDIUM;
              const isExpanded = expandedRow === r.transaction_id;
              return (
                <>
                  <tr
                    key={r.transaction_id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedRow(isExpanded ? null : r.transaction_id)}
                  >
                    <td className="px-4 py-3 font-bold text-slate-800">{r.transaction_id}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rc.bg} ${rc.text} ${rc.border}`}>
                        {risk}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{r.score.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">${Number(r.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.country || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{r.flagged_by}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.is_fraud
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {r.is_fraud ? "✓ FRAUD" : "✗ FP"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate font-sans text-xs">
                      {(r.fraud_reason || "").split(";")[0]}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.transaction_id}-detail`} className="bg-rose-50/30">
                      <td colSpan={8} className="px-6 py-4 border-l-4 border-rose-500">
                        <div className="space-y-3">
                          <div className="text-xs font-mono font-bold text-rose-800 uppercase tracking-wider">
                            🔬 Multi-Signal Fraud Evidence & Record Attribution
                          </div>
                          <div className="space-y-2">
                            {(r.fraud_reason || "No reason captured").split(";").map((s: string, i: number) => (
                              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-800 font-sans">
                                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                  {i + 1}
                                </span>
                                <span className="pt-0.5">{s.trim()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-3 pt-2">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-xs">
                              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase">TX Velocity (1h)</div>
                              <div className="text-base font-mono font-bold text-indigo-700 mt-0.5">{r.tx_freq_1h ?? "—"} tx/hr</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-xs">
                              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase">Geo Velocity</div>
                              <div className="text-base font-mono font-bold text-amber-700 mt-0.5">{r.geo_velocity ?? "—"} km/h</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-xs">
                              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase">Device Risk Score</div>
                              <div className="text-base font-mono font-bold text-violet-700 mt-0.5">{r.device_risk_score ?? "—"}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-mono text-slate-500">Page {fraudPage + 1} of {totalPages}</span>
          <div className="flex gap-2 font-mono text-xs">
            <button
              onClick={() => setFraudPage((p: number) => Math.max(0, p - 1))}
              disabled={fraudPage === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setFraudPage((p: number) => Math.min(totalPages - 1, p + 1))}
              disabled={fraudPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartsTab({ results }: { results: ExecutionResults }) {
  const [chartTab, setChartTab] = useState<"distribution" | "timeline">("distribution");
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800">Telemetry & Distribution Analytics</h3>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {(["distribution", "timeline"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold capitalize transition-all ${
                chartTab === t ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600"
              }`}
            >
              {t === "distribution" ? "Score Distribution" : "Flagged Over Time"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartTab === "distribution" ? (
            <BarChart data={results.score_distribution} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderRadius: "12px", color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {results.score_distribution.map((_: any, i: number) => (
                  <Cell key={i} fill={["#10B981", "#3B82F6", "#F59E0B", "#F97316", "#EF4444"][i] || "#64748B"} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={results.flagged_over_time} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderRadius: "12px", color: "#0F172A", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              />
              <Line type="monotone" dataKey="flagged" stroke="#EF4444" strokeWidth={3} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PipelineNodesTab({ results }: { results: ExecutionResults }) {
  const telemetry = (results as any).node_telemetry || {};
  const nodes = Object.values(telemetry) as any[];
  if (nodes.length === 0)
    return (
      <div className="p-10 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
        No node telemetry available.
      </div>
    );

  const CAT_ICON: Record<string, string> = {
    input: "📥",
    preprocessing: "⚙️",
    feature: "🧠",
    detection: "🔍",
    output: "📤",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {nodes.map((n: any) => (
        <div key={n.node_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{CAT_ICON[n.category] || "🔷"}</span>
              <div>
                <div className="text-sm font-bold text-slate-800">{n.label}</div>
                <div className="text-[10px] font-mono text-slate-500">{n.algorithm}</div>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                n.category === "detection"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : n.category === "feature"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : n.category === "preprocessing"
                  ? "bg-violet-50 text-violet-700 border-violet-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {n.category}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center font-mono">
            {[
              { l: "Inflow", v: n.inflow_count, c: "text-emerald-700" },
              { l: "Outflow", v: n.outflow_count, c: "text-blue-700" },
              { l: "Dropped", v: n.filtered_count, c: "text-amber-700" },
              { l: "Latency", v: `${n.execution_time_ms}ms`, c: "text-violet-700" },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-slate-50 rounded-xl border border-slate-200 p-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase">{l}</div>
                <div className={`text-sm font-black mt-0.5 ${c}`}>{typeof v === "number" ? v.toLocaleString() : v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
