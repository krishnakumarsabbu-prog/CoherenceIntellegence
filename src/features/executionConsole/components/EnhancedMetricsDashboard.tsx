/**
 * Enhanced Metrics Dashboard — a comprehensive, professional-grade analytics panel
 * with 15+ mathematical metrics, animated progress bars, a confusion matrix heatmap,
 * and a model-artifact loading trace. Designed for the Execution Console.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExecutionResults, ExecutionSummary } from "../types";
import type { ArtifactInfo } from "../api";
import { AnimatedNumber } from "./AnalyticsSections";

/* ------------------------------------------------------------------ */
/* Animated progress bar                                               */
/* ------------------------------------------------------------------ */

function ProgressBar({ value, max, color, label, sublabel }: { value: number; max: number; color: string; label: string; sublabel?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-gray-600">{label}</span>
        <span className="font-mono font-bold text-gray-800">
          {value.toLocaleString()}
          {sublabel && <span className="text-gray-400 ml-1">{sublabel}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full relative overflow-hidden"
          style={{ backgroundColor: color }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confusion Matrix Heatmap                                            */
/* ------------------------------------------------------------------ */

function ConfusionMatrix({ summary }: { summary: ExecutionSummary }) {
  const { true_positives: tp, false_positives: fp, false_negatives: fn, true_negatives: tn } = summary;
  const total = tp + fp + fn + tn || 1;
  const cells = [
    { label: "True Positives", value: tp, color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
    { label: "False Positives", value: fp, color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
    { label: "False Negatives", value: fn, color: "#EF4444", bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
    { label: "True Negatives", value: tn, color: "#64748B", bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-200" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map((c, i) => {
        const intensity = c.value / total;
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={`relative p-4 rounded-xl ${c.bg} ring-1 ${c.ring} overflow-hidden`}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundColor: c.color, opacity: 0.05 + intensity * 0.25 }}
            />
            <div className="relative">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${c.text} opacity-80`}>{c.label}</div>
              <div className="text-3xl font-black mt-1" style={{ color: c.color }}>
                <AnimatedNumber value={c.value} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1 font-mono">
                {(intensity * 100).toFixed(1)}% of total
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric pill with progress ring                                       */
/* ------------------------------------------------------------------ */

function MetricPill({ label, value, max, suffix, color, lowerBetter }: { label: string; value: number; max?: number; suffix?: string; color: string; lowerBetter?: boolean }) {
  const displayMax = max ?? 1;
  const pct = lowerBetter ? Math.max(0, 100 - (value / displayMax) * 100) : Math.min(100, (value / displayMax) * 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#E2E8F0" strokeWidth="4" />
          <motion.circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-[10px] font-mono font-bold" style={{ color }}>
            {suffix === "%" ? `${(value * 100).toFixed(0)}%` : value.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-gray-600 truncate">{label}</div>
        <div className="text-lg font-black text-gray-900">
          {suffix === "%" ? `${(value * 100).toFixed(2)}%` : value.toFixed(4)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Model Artifact Loading Panel                                         */
/* ------------------------------------------------------------------ */

export function ModelArtifactPanel({ artifacts, loading, pipelineId }: { artifacts: ArtifactInfo[]; loading: boolean; pipelineId: string | null }) {
  const joblibFiles = artifacts.filter((a) => a.name.endsWith(".joblib"));
  const ruleFiles = artifacts.filter((a) => a.name.endsWith(".json"));
  const totalSize = artifacts.reduce((sum, a) => sum + a.size_bytes, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 bg-gradient-to-r from-violet-50 via-white to-blue-50 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          Model & Joblib Artifact Trace
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
            ARTIFACT LOADING
          </span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Serialized models (.joblib) and rule configs (.json) loaded before execution
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-xl bg-violet-50 border border-violet-100">
            <div className="text-2xl font-black text-violet-700">
              <AnimatedNumber value={joblibFiles.length} />
            </div>
            <div className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">Joblib Models</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-2xl font-black text-blue-700">
              <AnimatedNumber value={ruleFiles.length} />
            </div>
            <div className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">Rule Configs</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-100 border border-slate-200">
            <div className="text-2xl font-black text-slate-700">
              <AnimatedNumber value={artifacts.length} />
            </div>
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Total Files</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="text-2xl font-black text-emerald-700">
              {(totalSize / 1024).toFixed(0)}
            </div>
            <div className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider">Total KB</div>
          </div>
        </div>

        {/* Loading flow steps */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Loading Sequence</div>
          <FlowStep label={`Scan artifact directory for pipeline ${pipelineId ?? "—"}`} done={artifacts.length > 0} active={loading && artifacts.length === 0} />
          <FlowStep label={`Load ${joblibFiles.length} joblib model(s) into memory`} done={joblibFiles.length > 0} active={loading && joblibFiles.length === 0} />
          <FlowStep label={`Parse ${ruleFiles.length} rule config(s)`} done={ruleFiles.length > 0} active={loading && ruleFiles.length === 0 && joblibFiles.length > 0} />
          <FlowStep label="Initialize detection engine" done={!loading && artifacts.length > 0} active={loading && artifacts.length > 0} />
        </div>

        {/* File list */}
        {artifacts.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Loaded Artifacts</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {artifacts.map((a) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                >
                  <span className={`font-mono font-bold ${a.name.endsWith(".joblib") ? "text-violet-500" : "text-blue-500"}`}>
                    {a.name.endsWith(".joblib") ? "[model]" : "[rules]"}
                  </span>
                  <span className="text-slate-700 font-mono truncate flex-1" title={a.name}>{a.name}</span>
                  <span className="text-slate-400 font-mono shrink-0">{(a.size_bytes / 1024).toFixed(1)}KB</span>
                  <span className="text-emerald-500 shrink-0">
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic py-2">
            {loading ? "Scanning for pre-trained models..." : "No pre-trained artifacts found - pipeline will train fresh models"}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FlowStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-emerald-100 text-emerald-600" : active ? "bg-amber-100 text-amber-500" : "bg-slate-100 text-slate-300"
        }`}
      >
        {done ? (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : active ? (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        ) : (
          <span className="w-1 h-1 rounded-full bg-slate-300" />
        )}
      </span>
      <span className={done ? "text-slate-700" : active ? "text-amber-700 font-medium" : "text-slate-400"}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mathematical metrics computation                                     */
/* ------------------------------------------------------------------ */

interface DerivedMetrics {
  accuracy: number;
  specificity: number;
  npv: number;
  fpr: number;
  fnr: number;
  balancedAccuracy: number;
  mcc: number;
  youdenJ: number;
  cohenKappa: number;
  fBeta: number;
  lift: number;
  prevalence: number;
  threatScore: number;
  markedness: number;
  fowlkesMallows: number;
}

function computeMetrics(s: ExecutionSummary): DerivedMetrics {
  const { true_positives: tp, false_positives: fp, false_negatives: fn, true_negatives: tn } = s;
  const total = tp + fp + fn + tn || 1;
  const pos = tp + fn || 1;
  const neg = tn + fp || 1;
  const predPos = tp + fp || 1;
  const predNeg = tn + fn || 1;

  const accuracy = (tp + tn) / total;
  const specificity = tn / neg;
  const npv = tn / predNeg;
  const fpr = fp / neg;
  const fnr = fn / pos;
  const balancedAccuracy = (s.recall + specificity) / 2;
  const mccNum = tp * tn - fp * fn;
  const mccDen = Math.sqrt(predPos * pos * neg * predNeg);
  const mcc = mccDen === 0 ? 0 : mccNum / mccDen;
  const youdenJ = s.recall + specificity - 1;
  const pe = ((pos / total) * (predPos / total)) + ((neg / total) * (predNeg / total));
  const cohenKappa = pe === 1 ? 0 : (accuracy - pe) / (1 - pe);
  const beta = 0.5;
  const fBeta = (1 + beta * beta) * (s.precision * s.recall) / (beta * beta * s.precision + s.recall || 1);
  const prevalence = pos / total;
  const lift = (s.precision / prevalence) || 0;
  const threatScore = tp / (tp + fp + fn || 1);
  const markedness = s.precision + npv - 1;
  const fowlkesMallows = Math.sqrt(s.precision * s.recall);

  return { accuracy, specificity, npv, fpr, fnr, balancedAccuracy, mcc, youdenJ, cohenKappa, fBeta, lift, prevalence, threatScore, markedness, fowlkesMallows };
}

/* ------------------------------------------------------------------ */
/* Main Enhanced Metrics Dashboard                                     */
/* ------------------------------------------------------------------ */

export default function EnhancedMetricsDashboard({ results, artifacts, artifactsLoading, pipelineId }: { results: ExecutionResults | null; artifacts: ArtifactInfo[]; artifactsLoading: boolean; pipelineId: string | null }) {
  const summary = results?.summary ?? null;
  const derived = useMemo(() => (summary ? computeMetrics(summary) : null), [summary]);
  const [chartMode, setChartMode] = useState<"radar" | "bar">("radar");

  if (!summary || !derived) {
    return (
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 grid place-items-center mx-auto mb-3 border border-blue-100">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">Enhanced Metrics Dashboard</p>
        <p className="text-xs text-gray-400 mt-1">Run a pipeline to unlock 15+ mathematical metrics, confusion matrix, and artifact trace.</p>
      </div>
    );
  }

  const radarData = [
    { metric: "Precision", value: +(summary.precision * 100).toFixed(1) },
    { metric: "Recall", value: +(summary.recall * 100).toFixed(1) },
    { metric: "F1", value: +(summary.f1 * 100).toFixed(1) },
    { metric: "Specificity", value: +(derived.specificity * 100).toFixed(1) },
    { metric: "Balanced Acc", value: +(derived.balancedAccuracy * 100).toFixed(1) },
    { metric: "NPV", value: +(derived.npv * 100).toFixed(1) },
  ];

  const barData = [
    { metric: "Precision", value: +(summary.precision * 100).toFixed(1), fill: "#2563EB" },
    { metric: "Recall", value: +(summary.recall * 100).toFixed(1), fill: "#F59E0B" },
    { metric: "F1", value: +(summary.f1 * 100).toFixed(1), fill: "#8B5CF6" },
    { metric: "Accuracy", value: +(derived.accuracy * 100).toFixed(1), fill: "#10B981" },
    { metric: "Specificity", value: +(derived.specificity * 100).toFixed(1), fill: "#06B6D4" },
    { metric: "Balanced Acc", value: +(derived.balancedAccuracy * 100).toFixed(1), fill: "#EC4899" },
    { metric: "MCC", value: +((derived.mcc + 1) / 2 * 100).toFixed(1), fill: "#F97316" },
    { metric: "Youden J", value: +((derived.youdenJ + 1) / 2 * 100).toFixed(1), fill: "#84CC16" },
  ];

  const allMetrics: { label: string; value: number; suffix?: string; color: string; lowerBetter?: boolean; formula?: string }[] = [
    { label: "Accuracy", value: derived.accuracy, suffix: "%", color: "#10B981", formula: "(TP+TN)/N" },
    { label: "Precision (PPV)", value: summary.precision, suffix: "%", color: "#2563EB", formula: "TP/(TP+FP)" },
    { label: "Recall (Sensitivity)", value: summary.recall, suffix: "%", color: "#F59E0B", formula: "TP/(TP+FN)" },
    { label: "F1 Score", value: summary.f1, color: "#8B5CF6", formula: "2*P*R/(P+R)" },
    { label: "F0.5 Score", value: derived.fBeta, color: "#A78BFA", formula: "Weighted F-beta" },
    { label: "Specificity (TNR)", value: derived.specificity, suffix: "%", color: "#06B6D4", formula: "TN/(TN+FP)" },
    { label: "Negative Predictive Value", value: derived.npv, suffix: "%", color: "#0EA5E9", formula: "TN/(TN+FN)" },
    { label: "Balanced Accuracy", value: derived.balancedAccuracy, suffix: "%", color: "#EC4899", formula: "(TPR+TNR)/2" },
    { label: "False Positive Rate", value: derived.fpr, suffix: "%", color: "#EF4444", lowerBetter: true, formula: "FP/(FP+TN)" },
    { label: "False Negative Rate", value: derived.fnr, suffix: "%", color: "#DC2626", lowerBetter: true, formula: "FN/(FN+TP)" },
    { label: "Matthews Correlation Coef", value: derived.mcc, color: "#F97316", formula: "(TP*TN-FP*FN)/sqrt(...)" },
    { label: "Youden's J Statistic", value: derived.youdenJ, color: "#84CC16", formula: "Sensitivity+Specificity-1" },
    { label: "Cohen's Kappa", value: derived.cohenKappa, color: "#14B8A6", formula: "(acc-pe)/(1-pe)" },
    { label: "Threat Score (CSI)", value: derived.threatScore, color: "#6366F1", formula: "TP/(TP+FP+FN)" },
    { label: "Markedness", value: derived.markedness, color: "#D946EF", formula: "PPV+NPV-1" },
    { label: "Fowlkes-Mallows", value: derived.fowlkesMallows, color: "#0891B2", formula: "sqrt(PPV*TPR)" },
    { label: "Lift Score", value: derived.lift, color: "#65A30D", formula: "PPV/prevalence" },
    { label: "Prevalence", value: derived.prevalence, suffix: "%", color: "#7C3AED", formula: "(TP+FN)/N" },
  ];

  return (
    <div className="space-y-5">
      {/* Confusion Matrix + Core Progress Bars */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            Confusion Matrix & Detection Volume
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              CLASSIFICATION HEATMAP
            </span>
          </h3>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConfusionMatrix summary={summary} />
          <div className="space-y-3">
            <ProgressBar label="Total Transactions" value={summary.total_transactions} max={summary.total_transactions} color="#6366F1" sublabel="processed" />
            <ProgressBar label="Flagged as Fraud" value={summary.flagged} max={summary.total_transactions} color="#EF4444" sublabel={`(${(summary.flagged / (summary.total_transactions || 1) * 100).toFixed(1)}%)`} />
            <ProgressBar label="True Positives" value={summary.true_positives} max={summary.flagged || 1} color="#10B981" sublabel="correct catches" />
            <ProgressBar label="False Positives" value={summary.false_positives} max={summary.flagged || 1} color="#F59E0B" sublabel="false alarms" />
            <ProgressBar label="False Negatives" value={summary.false_negatives} max={summary.true_positives + summary.false_negatives || 1} color="#DC2626" sublabel="missed fraud" />
          </div>
        </div>
      </motion.div>

      {/* Model Artifact Panel */}
      <ModelArtifactPanel artifacts={artifacts} loading={artifactsLoading} pipelineId={pipelineId} />

      {/* Core Metric Pills (Progress Rings) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-3">Core Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricPill label="Precision" value={summary.precision} max={1} suffix="%" color="#2563EB" />
          <MetricPill label="Recall" value={summary.recall} max={1} suffix="%" color="#F59E0B" />
          <MetricPill label="F1 Score" value={summary.f1} max={1} color="#8B5CF6" />
          <MetricPill label="FPR" value={derived.fpr} max={1} suffix="%" color="#EF4444" lowerBetter />
        </div>
      </motion.div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">Visual Metric Comparison</h3>
          <div className="flex gap-1">
            <button onClick={() => setChartMode("radar")} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === "radar" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>Radar</button>
            <button onClick={() => setChartMode("bar")} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === "bar" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>Bar</button>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "radar" ? (
              <RadarChart data={radarData} margin={{ top: 16, right: 30, left: 30, bottom: 16 }}>
                <PolarGrid stroke="#E5E8ED" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#525968" }} />
                <Radar dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            ) : (
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8ED" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#525968" }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} unit="%" />
                <Tooltip cursor={{ fill: "#F4F6F8" }} />
                <Bar dataKey="value" name="Score" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Full 15+ Metrics Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            Complete Mathematical Metrics
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {allMetrics.length} METRICS
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Advanced statistical measures for fraud detection model evaluation</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50/60">
                <th className="px-4 py-2.5">Metric</th>
                <th className="px-4 py-2.5">Formula</th>
                <th className="px-4 py-2.5 text-right">Value</th>
                <th className="px-4 py-2.5 text-center">Visual</th>
              </tr>
            </thead>
            <tbody>
              {allMetrics.map((m, i) => {
                const pct = m.suffix === "%" ? m.value * 100 : m.value * 100;
                const clampedPct = Math.max(0, Math.min(100, m.lowerBetter ? 100 - pct : pct));
                return (
                  <motion.tr
                    key={m.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-gray-400">{m.formula}</td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono" style={{ color: m.color }}>
                      {m.suffix === "%" ? `${(m.value * 100).toFixed(2)}%` : m.value.toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-full max-w-[120px] mx-auto">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${clampedPct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.03, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
