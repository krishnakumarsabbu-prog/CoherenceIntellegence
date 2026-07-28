import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import type { ComparisonResult, ExecutionSummary } from "../types";

const PIPE_COLORS = ["#2E5AAC", "#0D9488", "#D97706"];

type ChartMode = "radar" | "bar" | "line";

interface MetricDef {
  key: string;
  label: string;
  pct: boolean;
  lowerBetter?: boolean;
}

const ALL_METRICS: MetricDef[] = [
  { key: "precision", label: "Precision", pct: true },
  { key: "recall", label: "Recall", pct: true },
  { key: "f1", label: "F1 Score", pct: true },
  { key: "false_positive_rate", label: "FPR", pct: true, lowerBetter: true },
  { key: "true_positives", label: "True Positives", pct: false },
  { key: "false_positives", label: "False Positives", pct: false, lowerBetter: true },
  { key: "false_negatives", label: "False Negatives", pct: false, lowerBetter: true },
  { key: "true_negatives", label: "True Negatives", pct: false },
  { key: "flagged", label: "Flagged", pct: false },
  { key: "execution_time_seconds", label: "Exec Time", pct: false, lowerBetter: true },
];

const RADAR_METRICS: MetricDef[] = [
  { key: "precision", label: "Precision", pct: true },
  { key: "recall", label: "Recall", pct: true },
  { key: "f1", label: "F1", pct: true },
  { key: "false_positive_rate", label: "FPR", pct: true, lowerBetter: true },
];

export default function MetricsComparison({ results }: { results: ComparisonResult[] }) {
  const valid = useMemo(() => results.filter((r) => r.summary && !r.error), [results]);
  const [chartMode, setChartMode] = useState<ChartMode>("radar");

  const chartData = useMemo(() => {
    return RADAR_METRICS.map((m) => {
      const point: Record<string, unknown> = { metric: m.label };
      for (const r of valid) {
        const v = r.summary![m.key as keyof ExecutionSummary] as number;
        point[r.pipeline_name] = m.pct ? +(v * 100).toFixed(1) : +v.toFixed(3);
      }
      return point;
    });
  }, [valid]);

  const barData = useMemo(() => {
    return ALL_METRICS.filter((m) => m.pct).map((m) => {
      const point: Record<string, unknown> = { metric: m.label };
      for (const r of valid) {
        const v = r.summary![m.key as keyof ExecutionSummary] as number;
        point[r.pipeline_name] = +(v * 100).toFixed(1);
      }
      return point;
    });
  }, [valid]);

  const lineData = useMemo(() => {
    return valid.map((r) => {
      const s = r.summary!;
      const acc = (s.true_positives + s.true_negatives) / (s.total_transactions || 1);
      return {
        name: r.pipeline_name,
        Precision: +(s.precision * 100).toFixed(1),
        Recall: +(s.recall * 100).toFixed(1),
        F1: +(s.f1 * 100).toFixed(1),
        Accuracy: +(acc * 100).toFixed(1),
      };
    });
  }, [valid]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Full metrics table */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Complete Metrics Comparison</h3>
          <p className="text-xs text-gray-500 mt-0.5">{ALL_METRICS.length}+ detection metrics across all pipelines</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50/60">
                <th className="px-4 py-2.5 font-medium">Metric</th>
                {valid.map((r, i) => (
                  <th key={r.pipeline_id} className="px-4 py-2.5 font-medium" style={{ color: PIPE_COLORS[i % 3] }}>
                    {r.pipeline_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_METRICS.map((m) => {
                const values = valid.map((r) => r.summary![m.key as keyof ExecutionSummary] as number);
                const bestIdx = m.lowerBetter
                  ? values.indexOf(Math.min(...values))
                  : values.indexOf(Math.max(...values));
                return (
                  <tr key={m.key} className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                    {valid.map((r, i) => {
                      const v = values[i];
                      const isBest = i === bestIdx;
                      const display = m.pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(0);
                      return (
                        <td key={r.pipeline_id} className={`px-4 py-2.5 text-right ${isBest ? "font-bold text-emerald-600" : "text-gray-600"}`}>
                          {display}
                          {isBest && <span className="ml-1 text-[9px] text-emerald-500">BEST</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Derived metrics */}
              <DerivedRow label="Accuracy" valid={valid} compute={(s) => (s.true_positives + s.true_negatives) / (s.total_transactions || 1)} pct />
              <DerivedRow label="Specificity (TNR)" valid={valid} compute={(s) => { const d = s.true_negatives + s.false_positives; return d === 0 ? 0 : s.true_negatives / d; }} pct />
              <DerivedRow label="NPV" valid={valid} compute={(s) => { const d = s.true_negatives + s.false_negatives; return d === 0 ? 0 : s.true_negatives / d; }} pct />
              <DerivedRow label="Balanced Accuracy" valid={valid} compute={(s) => { const tnr = s.true_negatives + s.false_positives === 0 ? 0 : s.true_negatives / (s.true_negatives + s.false_positives); return (s.recall + tnr) / 2; }} pct />
              <DerivedRow label="MCC" valid={valid} compute={(s) => { const n = s.true_positives * s.true_negatives - s.false_positives * s.false_negatives; const d = Math.sqrt((s.true_positives + s.false_positives) * (s.true_positives + s.false_negatives) * (s.true_negatives + s.false_positives) * (s.true_negatives + s.false_negatives)); return d === 0 ? 0 : n / d; }} />
              <DerivedRow label="Youden's J" valid={valid} compute={(s) => { const tnr = s.true_negatives + s.false_positives === 0 ? 0 : s.true_negatives / (s.true_negatives + s.false_positives); return s.recall + tnr - 1; }} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">Visual Metric Comparison</h3>
          <div className="flex gap-1">
            <TabButton active={chartMode === "radar"} onClick={() => setChartMode("radar")}>Radar</TabButton>
            <TabButton active={chartMode === "bar"} onClick={() => setChartMode("bar")}>Grouped Bar</TabButton>
            <TabButton active={chartMode === "line"} onClick={() => setChartMode("line")}>Line</TabButton>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "radar" ? (
              <RadarChart data={chartData} margin={{ top: 16, right: 30, left: 30, bottom: 16 }}>
                <PolarGrid stroke="#E5E8ED" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#525968" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#A9B0BD" }} />
                {valid.map((r, i) => (
                  <Radar key={r.pipeline_id} name={r.pipeline_name} dataKey={r.pipeline_name} stroke={PIPE_COLORS[i % 3]} fill={PIPE_COLORS[i % 3]} fillOpacity={0.12} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            ) : chartMode === "bar" ? (
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: "#525968" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} unit="%" />
                <Tooltip cursor={{ fill: "#F4F6F8" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {valid.map((r, i) => (
                  <Bar key={r.pipeline_id} dataKey={r.pipeline_name} fill={PIPE_COLORS[i % 3]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#525968" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} unit="%" domain={[0, 100]} />
                <Tooltip cursor={{ stroke: "#E5E8ED" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Precision" stroke="#2E5AAC" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Recall" stroke="#0D9488" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="F1" stroke="#D97706" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Accuracy" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

function DerivedRow({
  label,
  valid,
  compute,
  pct,
}: {
  label: string;
  valid: ComparisonResult[];
  compute: (s: ExecutionSummary) => number;
  pct?: boolean;
}) {
  const values = valid.map((r) => compute(r.summary!));
  const bestIdx = values.indexOf(Math.max(...values));
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors">
      <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
      {valid.map((r, i) => {
        const v = values[i];
        const isBest = i === bestIdx;
        const display = pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(4);
        return (
          <td key={r.pipeline_id} className={`px-4 py-2.5 text-right ${isBest ? "font-bold text-emerald-600" : "text-gray-600"}`}>
            {display}
            {isBest && <span className="ml-1 text-[9px] text-emerald-500">BEST</span>}
          </td>
        );
      })}
    </tr>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
        active ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
