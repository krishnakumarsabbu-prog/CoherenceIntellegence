import { useState } from "react";

interface NodeTelemetry {
  node_id: string;
  label: string;
  category: string;
  algorithm: string;
  inflow_count: number;
  outflow_count: number;
  filtered_count: number;
  execution_time_ms: number;
  columns: string[];
  sample_records: Record<string, any>[];
  details: Record<string, any>;
}

interface Props {
  nodeId: string | null;
  nodeLabel?: string;
  telemetry?: NodeTelemetry | null;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  input:         { bg: "bg-blue-600",   text: "text-blue-700",   border: "border-blue-200",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  preprocessing: { bg: "bg-violet-600", text: "text-violet-700", border: "border-violet-200", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  feature:       { bg: "bg-amber-500",  text: "text-amber-700",  border: "border-amber-200",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  detection:     { bg: "bg-rose-600",   text: "text-rose-700",   border: "border-rose-200",   badge: "bg-rose-50 text-rose-700 border-rose-200" },
  output:        { bg: "bg-emerald-600",text: "text-emerald-700",border: "border-emerald-200",badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const CATEGORY_ICONS: Record<string, string> = {
  input: "📥", preprocessing: "⚙️", feature: "🧠", detection: "🔍", output: "📤",
};

export default function NodeDetailModal({ nodeId, nodeLabel, telemetry, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "transforms" | "features" | "clusters" | "fraud" | "data">("overview");

  if (!nodeId) return null;

  const label = telemetry?.label || nodeLabel || "Node Analysis";
  const category = (telemetry?.category || "node").toLowerCase();
  const algo = telemetry?.algorithm || "—";
  const details = telemetry?.details || {};
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.input;
  const icon = CATEGORY_ICONS[category] || "🔷";

  const hasTransforms = category === "preprocessing" && details.transformations?.length > 0;
  const hasFeatures   = (details.feature_importances || []).length > 0;
  const hasClusters   = (details.clusters || []).length > 0;
  const hasAttributions = (details.record_attributions || []).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center text-xl text-white shadow-sm`}>{icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors.badge}`}>{category}</span>
                <span className="text-[10px] text-slate-400 font-mono">ID: {nodeId}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">{label}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{algo}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all flex items-center justify-center font-bold text-sm">✕</button>
        </div>

        {/* KPI Banner */}
        <div className="grid grid-cols-5 bg-slate-50/80 border-b border-slate-200 divide-x divide-slate-200">
          {[
            { label: "Inflow Records", value: telemetry?.inflow_count?.toLocaleString() ?? "—", color: "text-emerald-700" },
            { label: "Outflow Records", value: telemetry?.outflow_count?.toLocaleString() ?? "—", color: "text-blue-700" },
            { label: "Filtered / Dropped", value: telemetry?.filtered_count ?? 0, color: "text-amber-700" },
            { label: "Execution Latency", value: telemetry ? `${telemetry.execution_time_ms} ms` : "—", color: "text-purple-700" },
            { label: "Active Columns", value: telemetry?.columns?.length ?? "—", color: "text-indigo-700" },
          ].map((m) => (
            <div key={m.label} className="px-4 py-3">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">{m.label}</p>
              <p className={`text-xl font-black mt-0.5 font-mono ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto">
          {([
            ["overview",   "📊 Overview & Flow"] as [string, string],
            hasTransforms ? ["transforms", "⚙️ Transformations"] as [string, string] : null,
            hasFeatures   ? ["features",   "🧠 Feature Signals"] as [string, string] : null,
            hasClusters   ? ["clusters",   "🗂️ Clusters"] as [string, string] : null,
            hasAttributions ? ["fraud",    "⚠️ Record Attribution"] as [string, string] : null,
            ["data",       "🔬 Sample Payload"] as [string, string],
          ]).filter((x): x is [string, string] => x !== null).map(([id, lbl]) => (
            <button key={id!}
              onClick={() => setActiveTab(id as any)}
              className={`px-3 py-3 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === id
                  ? "border-accent-600 text-accent-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >{lbl}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
          {!telemetry ? (
            <div className="p-16 text-center text-sm text-slate-400">
              <div className="text-4xl mb-3">🕐</div>
              Run the pipeline to view real-time node analysis.
            </div>
          ) : activeTab === "overview" ? (
            <OverviewTab telemetry={telemetry} algo={algo} details={details} colors={colors} />
          ) : activeTab === "transforms" ? (
            <TransformsTab details={details} />
          ) : activeTab === "features" ? (
            <FeaturesTab details={details} />
          ) : activeTab === "clusters" ? (
            <ClustersTab details={details} />
          ) : activeTab === "fraud" ? (
            <AttributionTab details={details} />
          ) : (
            <SampleDataTab telemetry={telemetry} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">Engine: <strong className="text-accent-700">{algo}</strong></span>
          <button onClick={onClose} className="btn-primary text-xs px-5 py-2">Close Analysis</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function OverviewTab({ telemetry, algo, details, colors }: { telemetry: NodeTelemetry; algo: string; details: Record<string, any>; colors: any }) {
  const retentionPct = telemetry.inflow_count > 0
    ? Math.round((telemetry.outflow_count / telemetry.inflow_count) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Flow visualizer */}
      <Section title="Data Flow Through Node" subtitle="Records entering and exiting this processing stage">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">INFLOW</div>
            <div className="text-3xl font-black text-emerald-800">{telemetry.inflow_count.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-600 mt-1">Records Ingested</div>
          </div>
          <div className="flex flex-col items-center gap-1 min-w-[120px]">
            <div className="text-[10px] font-bold text-slate-600 uppercase">Algorithm</div>
            <div className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${colors.badge}`}>{algo}</div>
            <div className="text-slate-400 text-lg">→</div>
            <div className="text-[10px] text-slate-500">{telemetry.execution_time_ms}ms latency</div>
          </div>
          <div className="flex-1 bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-center">
            <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">OUTFLOW</div>
            <div className="text-3xl font-black text-cyan-800">{telemetry.outflow_count.toLocaleString()}</div>
            <div className="text-[10px] text-cyan-600 mt-1">Records Emitted</div>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[11px] text-slate-600">
            <span>Record Retention Rate</span>
            <span className="font-bold">{retentionPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${retentionPct > 90 ? "bg-emerald-500" : retentionPct > 70 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${retentionPct}%` }}
            />
          </div>
        </div>
      </Section>

      {/* Category-specific summary */}
      {details.input_type && (
        <Section title="Input Node Summary" subtitle="Data source details">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV k="Input Type" v={details.input_type} />
            <KV k="File / Source" v={details.file_name || "transaction_feed"} />
            <KV k="Rules Extracted" v={details.rules_extracted_count ?? 0} />
            <KV k="Schema Columns" v={telemetry.columns.length} />
          </div>
        </Section>
      )}

      {details.rows_before !== undefined && (
        <Section title="Preprocessing Impact" subtitle="Row and column changes after transformation">
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { l: "Rows Before", v: details.rows_before },
              { l: "Rows After",  v: details.rows_after  },
              { l: "Cols Before", v: details.cols_before  },
              { l: "Cols After",  v: details.cols_after   },
            ].map(({ l, v }) => (
              <div key={l} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">{l}</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">Null cells estimated & imputed: <strong className="text-slate-700">{details.dropped_nulls_count ?? 0}</strong></div>
        </Section>
      )}

      {details.scored_records_count !== undefined && (
        <Section title="Detection Model Scoring" subtitle="Real ML engine results">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { l: "Scored Records", v: details.scored_records_count, c: "text-slate-900" },
              { l: "Min Score", v: details.anomaly_score_stats?.min ?? "—", c: "text-emerald-700" },
              { l: "Mean Score", v: details.anomaly_score_stats?.mean ?? "—", c: "text-amber-700" },
              { l: "Max Score", v: details.anomaly_score_stats?.max ?? "—", c: "text-rose-700" },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{l}</div>
                <div className={`text-xl font-black mt-0.5 ${c}`}>{typeof v === "number" ? v.toFixed(4) : v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Active columns */}
      <Section title={`Active Schema Signals (${telemetry.columns.length} columns)`} subtitle="Features present in this node's output dataframe">
        <div className="flex flex-wrap gap-1.5">
          {telemetry.columns.map((col) => (
            <span key={col} className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">{col}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function TransformsTab({ details }: { details: Record<string, any> }) {
  const transforms = details.transformations || [];
  return (
    <div className="space-y-4">
      <Section title="Applied Transformations" subtitle={`${transforms.length} transformation steps executed on this node`}>
        <div className="space-y-3">
          {transforms.map((t: any, i: number) => (
            <div key={i} className="p-4 rounded-xl bg-violet-50 border border-violet-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">{i+1}</span>
                  <span className="text-sm font-bold text-violet-900">{t.step}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-violet-300 text-violet-700">{t.method}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="font-bold text-slate-600">Formula: </span>
                  <code className="font-mono text-violet-800 bg-white px-1 py-0.5 rounded border border-violet-200">{t.formula || "—"}</code>
                </div>
                <div>
                  <span className="font-bold text-slate-600">Records Affected: </span>
                  <span className="font-bold text-slate-900">{(t.records_affected ?? "—").toLocaleString?.() ?? t.records_affected}</span>
                </div>
              </div>
              <div className="text-[11px]">
                <span className="font-bold text-slate-600">Affected Columns: </span>
                <span className="font-mono text-slate-800">{(t.affected_columns || []).join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function FeaturesTab({ details }: { details: Record<string, any> }) {
  const importances: any[] = details.feature_importances || [];
  return (
    <div className="space-y-4">
      <Section title="Feature Importance & Signal Analysis" subtitle="Mathematical influence weights computed by selected algorithm">
        <div className="space-y-3">
          {importances.map((item: any, i: number) => {
            const pct = Math.round(item.importance * 100);
            return (
              <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-amber-900">#{i+1} {item.feature}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 border border-amber-300 text-amber-800">{item.type}</span>
                  </div>
                  <span className="text-lg font-black text-amber-700">{pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-amber-100 border border-amber-200 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="font-bold text-slate-600">Formula: </span><code className="font-mono text-amber-800">{item.formula}</code></div>
                  <div><span className="font-bold text-slate-600">Rationale: </span><span className="text-slate-700">{item.description}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function ClustersTab({ details }: { details: Record<string, any> }) {
  const clusters: any[] = details.clusters || [];
  const total = clusters.reduce((s: number, c: any) => s + (c.count || 0), 0);
  return (
    <div className="space-y-4">
      <Section title="Cluster Analysis" subtitle={`${clusters.length} clusters formed • ${total.toLocaleString()} total records distributed`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clusters.map((c: any, i: number) => {
            const riskPct = Math.round((c.risk_score || 0) * 100);
            const isHighRisk = riskPct > 50;
            return (
              <div key={i} className={`p-4 rounded-xl border space-y-3 ${isHighRisk ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isHighRisk ? "text-rose-500" : "text-emerald-500"}`}>
                      {isHighRisk ? "⚠️ HIGH RISK CLUSTER" : "✅ BASELINE CLUSTER"}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{c.cluster_name || `Cluster ${c.cluster_id}`}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${isHighRisk ? "bg-rose-100 text-rose-700 border border-rose-300" : "bg-emerald-100 text-emerald-700 border border-emerald-300"}`}>
                    {(c.count || 0).toLocaleString()} records
                  </span>
                </div>
                {c.risk_score !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Centroid Risk Score</span>
                      <span className="font-black">{riskPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/50 border overflow-hidden">
                      <div className={`h-full rounded-full ${isHighRisk ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${riskPct}%` }} />
                    </div>
                  </div>
                )}
                {c.assignment_rationale && (
                  <p className="text-[11px] text-slate-600 leading-snug">{c.assignment_rationale}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function AttributionTab({ details }: { details: Record<string, any> }) {
  const attributions: any[] = details.record_attributions || [];
  return (
    <div className="space-y-4">
      <Section title="Record-Level Attribution & Explanation" subtitle={`Why each of ${attributions.length} sampled records was assigned to its cluster`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2.5 text-left">Transaction ID</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-left">Primary Signal</th>
                <th className="px-3 py-2.5 text-left">Assigned Cluster</th>
                <th className="px-3 py-2.5 text-center">Proximity</th>
                <th className="px-3 py-2.5 text-left">Model Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attributions.map((att: any, idx: number) => {
                const isRisk = att.assigned_cluster?.toLowerCase().includes("risk") || att.assigned_cluster?.toLowerCase().includes("anomaly") || att.assigned_cluster?.toLowerCase().includes("fraud");
                return (
                  <tr key={idx} className={`hover:bg-slate-50 ${isRisk ? "bg-rose-50/40" : ""}`}>
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{att.transaction_id}</td>
                    <td className="px-3 py-2.5 font-mono text-right font-semibold text-slate-700">${Number(att.amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{att.top_feature}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${isRisk ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {att.assigned_cluster}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600">{att.cluster_distance}</td>
                    <td className="px-3 py-2.5 text-slate-600 leading-snug max-w-xs text-[11px]">{att.explanation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function SampleDataTab({ telemetry }: { telemetry: NodeTelemetry }) {
  const records = telemetry.sample_records || [];
  if (records.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No payload records captured.</div>
  );
  const keys = Object.keys(records[0] || {}).slice(0, 12);
  return (
    <Section title={`Raw Payload Inspector — Top ${records.length} Records`} subtitle="Actual data flowing through this node at execution time">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 sticky top-0">
            <tr>{keys.map((k) => <th key={k} className="px-3 py-2.5 text-left whitespace-nowrap">{k}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {records.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-800">
                    {String(r[k] ?? "—").slice(0, 30)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k}</div>
      <div className="text-sm font-bold text-slate-900 mt-0.5">{String(v)}</div>
    </div>
  );
}
