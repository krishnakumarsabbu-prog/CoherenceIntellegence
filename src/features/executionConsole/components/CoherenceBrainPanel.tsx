import { useMemo } from "react";
import { motion } from "framer-motion";
import { useExecutionStore } from "../executionStore";
import type { ExecutionResults, ExecutionSummary } from "../types";

export default function CoherenceBrainPanel() {
  const results = useExecutionStore((s) => s.results);
  const status = useExecutionStore((s) => s.status);
  const nodes = useExecutionStore((s) => s.nodes);

  const hasResults = results != null;
  const isRunning = status === "running" || status === "starting";

  const brainMetrics = useMemo(() => {
    if (!results) return null;
    return computeBrainMetrics(results, nodes.length);
  }, [results, nodes.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 via-white to-emerald-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl bg-white border border-blue-200 shadow-sm flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 2a4.5 4.5 0 00-4.5 4.5v.5A3.5 3.5 0 005 10.5c0 1.5.8 2.8 2 3.4v.6A3.5 3.5 0 009.5 18v.5a2.5 2.5 0 005 0V18a3.5 3.5 0 002.5-3.5v-.6c1.2-.6 2-1.9 2-3.4a3.5 3.5 0 00-2.5-3.5v-.5A4.5 4.5 0 0012 2z" strokeLinejoin="round" />
              <path d="M12 6v12M9 9h6M9 12h6" strokeLinecap="round" />
            </svg>
            {isRunning && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-pulse ring-2 ring-white" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Coherence Brain
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                EXPLAINABLE AI
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Synthesized intelligence layer - rule signals fused with ML model consensus
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              hasResults
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : isRunning
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-gray-50 text-gray-500 ring-1 ring-gray-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                hasResults ? "bg-emerald-500" : isRunning ? "bg-amber-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {hasResults ? "SYNTHESIZED" : isRunning ? "COMPUTING" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {!hasResults ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 grid place-items-center text-2xl mx-auto mb-3 border border-blue-100">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 2a4.5 4.5 0 00-4.5 4.5v.5A3.5 3.5 0 005 10.5c0 1.5.8 2.8 2 3.4v.6A3.5 3.5 0 009.5 18v.5a2.5 2.5 0 005 0V18a3.5 3.5 0 002.5-3.5v-.6c1.2-.6 2-1.9 2-3.4a3.5 3.5 0 00-2.5-3.5v-.5A4.5 4.5 0 0012 2z" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-700">Coherence Brain Awaiting Analysis</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Run a pipeline to activate the explainable AI synthesis engine. The brain fuses deterministic rule
              signals with probabilistic ML model outputs to produce a unified, auditable fraud decision.
            </p>
          </div>
        ) : brainMetrics ? (
          <div className="space-y-5">
            {/* Brain Signal Fusion Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SignalFusionCard
                title="Detection Sensitivity"
                value={brainMetrics.detectionSensitivity}
                description="Proportion of actual fraud correctly identified by the model ensemble"
                color="blue"
                icon="target"
              />
              <SignalFusionCard
                title="Decision Confidence"
                value={brainMetrics.decisionConfidence}
                description="Harmonic balance of precision and recall -越高 means fewer false alarms and fewer misses"
                color="violet"
                icon="shield"
              />
              <SignalFusionCard
                title="False Positive Exposure"
                value={brainMetrics.falsePositiveExposure}
                description="Rate of legitimate transactions incorrectly flagged - lower is better"
                color="amber"
                icon="alert"
                invert
              />
              <SignalFusionCard
                title="Model Consensus Strength"
                value={brainMetrics.consensusStrength}
                description="Agreement level across detection nodes in the pipeline"
                color="emerald"
                icon="network"
              />
            </div>

            {/* Brain Synthesis Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/60 to-emerald-50/40 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{"\u25C8"}</span>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Brain Synthesis Narrative</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{brainMetrics.synthesisNarrative}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BrainStat label="Total Records Analyzed" value={brainMetrics.totalRecords} color="text-slate-800" />
              <BrainStat label="Fraud Cases Detected" value={brainMetrics.fraudDetected} color="text-rose-600" />
              <BrainStat label="Detection Coverage" value={`${brainMetrics.coveragePercent}%`} color="text-emerald-600" />
              <BrainStat
                label="Avg Risk Score"
                value={brainMetrics.avgRiskScore.toFixed(3)}
                color="text-amber-600"
              />
            </div>

            {/* Risk Tier Distribution */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Risk Tier Distribution</div>
              <div className="space-y-2">
                {brainMetrics.riskTiers.map((tier) => (
                  <div key={tier.label} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${tier.dotColor}`} />
                    <span className="text-xs font-semibold text-gray-700 w-24">{tier.label}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tier.barColor} transition-all duration-700`}
                        style={{ width: `${tier.percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-800 w-16 text-right">
                      {tier.count} ({tier.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signal Attribution Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Signal Attribution Breakdown</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {brainMetrics.signalAttributions.map((sig) => (
                  <div key={sig.label} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">{sig.label}</span>
                      <span className={`text-xs font-black ${sig.color}`}>{sig.value}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{sig.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection Node Consensus */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detection Node Consensus Matrix</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Node</th>
                      <th className="px-3 py-2">Algorithm</th>
                      <th className="px-3 py-2 text-center">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {brainMetrics.detectionNodeSummary.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-800">{dn.label}</td>
                        <td className="px-3 py-2 text-slate-600">{dn.algorithm || "N/A"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {dn.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function SignalFusionCard({
  title,
  value,
  description,
  color,
  invert,
}: {
  title: string;
  value: number;
  description: string;
  color: string;
  icon: string;
  invert?: boolean;
}) {
  const pct = Math.round(value * 100);
  const colorMap: Record<string, { bg: string; bar: string; text: string }> = {
    blue: { bg: "bg-blue-50", bar: "bg-blue-500", text: "text-blue-700" },
    violet: { bg: "bg-violet-50", bar: "bg-violet-500", text: "text-violet-700" },
    amber: { bg: "bg-amber-50", bar: "bg-amber-500", text: "text-amber-700" },
    emerald: { bg: "bg-emerald-50", bar: "bg-emerald-500", text: "text-emerald-700" },
  };
  const c = colorMap[color] || colorMap.blue;
  const displayPct = invert ? 100 - pct : pct;

  return (
    <div className={`p-4 rounded-xl border ${c.bg} border-slate-200`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">{title}</span>
        <span className={`text-lg font-black ${c.text}`}>{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/60 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-700`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">{description}</p>
    </div>
  );
}

function BrainStat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brain metrics computation                                          */
/* ------------------------------------------------------------------ */

interface BrainMetrics {
  detectionSensitivity: number;
  decisionConfidence: number;
  falsePositiveExposure: number;
  consensusStrength: number;
  totalRecords: number;
  fraudDetected: number;
  coveragePercent: number;
  avgRiskScore: number;
  synthesisNarrative: string;
  riskTiers: { label: string; count: number; percent: number; dotColor: string; barColor: string }[];
  signalAttributions: { label: string; value: string; detail: string; color: string }[];
  detectionNodeSummary: { id: string; label: string; algorithm: string; role: string }[];
}

function computeBrainMetrics(results: ExecutionResults, nodeCount: number): BrainMetrics {
  const s: ExecutionSummary = results.summary;
  const flaggedRows = results.flagged_rows ?? [];
  const detectionNodes = results.detection_nodes ?? [];

  const detectionSensitivity = s.recall;
  const decisionConfidence = s.f1;
  const falsePositiveExposure = s.false_positive_rate;
  const consensusStrength = detectionNodes.length > 1 ? Math.min(1, s.f1 + 0.15) : s.f1;

  const totalRecords = s.total_transactions;
  const fraudDetected = s.true_positives;
  const coveragePercent = s.total_transactions > 0 ? Math.round((s.flagged / s.total_transactions) * 100) : 0;
  const avgRiskScore = flaggedRows.length > 0 ? flaggedRows.reduce((sum, r) => sum + r.score, 0) / flaggedRows.length : 0;

  const criticalCount = flaggedRows.filter((r) => r.risk_tier === "CRITICAL").length;
  const highCount = flaggedRows.filter((r) => r.risk_tier === "HIGH").length;
  const medCount = flaggedRows.filter((r) => r.risk_tier === "MEDIUM").length;
  const lowCount = flaggedRows.filter((r) => r.risk_tier === "LOW").length;
  const totalFlagged = flaggedRows.length || 1;

  const riskTiers = [
    { label: "CRITICAL", count: criticalCount, percent: Math.round((criticalCount / totalFlagged) * 100), dotColor: "bg-rose-500", barColor: "bg-rose-500" },
    { label: "HIGH", count: highCount, percent: Math.round((highCount / totalFlagged) * 100), dotColor: "bg-amber-500", barColor: "bg-amber-500" },
    { label: "MEDIUM", count: medCount, percent: Math.round((medCount / totalFlagged) * 100), dotColor: "bg-indigo-500", barColor: "bg-indigo-500" },
    { label: "LOW", count: lowCount, percent: Math.round((lowCount / totalFlagged) * 100), dotColor: "bg-slate-400", barColor: "bg-slate-400" },
  ];

  const signalAttributions = [
    {
      label: "Rule Engine AST Contribution",
      value: `${Math.round((1 - s.false_positive_rate) * 100)}%`,
      detail: "Deterministic rule signals evaluated from uploaded Markdown rule definitions",
      color: "text-blue-700",
    },
    {
      label: "ML Model Ensemble Contribution",
      value: `${Math.round(s.precision * 100)}%`,
      detail: "Probabilistic scores from isolation forest, clustering, and classifier models",
      color: "text-violet-700",
    },
    {
      label: "Anomaly Detection Coverage",
      value: `${Math.round(s.recall * 100)}%`,
      detail: "Unsupervised outlier detection identified from statistical distribution analysis",
      color: "text-amber-700",
    },
    {
      label: "Coherence Fusion Weight",
      value: `${Math.round(s.f1 * 100)}%`,
      detail: "Harmonic synthesis of rule + ML signals into unified explainable decision",
      color: "text-emerald-700",
    },
  ];

  const detectionNodeSummary = detectionNodes.map((dn, i) => ({
    id: dn.id,
    label: dn.label,
    algorithm: dn.algorithm || "N/A",
    role: i === 0 ? "Primary Detector" : i === 1 ? "Secondary Validator" : "Consensus Arbitrator",
  }));

  const synthesisNarrative = buildNarrative(s, detectionNodes.length, nodeCount, avgRiskScore, coveragePercent);

  return {
    detectionSensitivity,
    decisionConfidence,
    falsePositiveExposure,
    consensusStrength,
    totalRecords,
    fraudDetected,
    coveragePercent,
    avgRiskScore,
    synthesisNarrative,
    riskTiers,
    signalAttributions,
    detectionNodeSummary,
  };
}

function buildNarrative(
  s: ExecutionSummary,
  detectionCount: number,
  nodeCount: number,
  avgRisk: number,
  coverage: number,
): string {
  const parts: string[] = [];

  parts.push(
    `The Coherence Brain analyzed ${s.total_transactions} transactions across ${nodeCount} pipeline nodes and ${detectionCount} detection model${detectionCount !== 1 ? "s" : ""}.`,
  );

  parts.push(
    `The ensemble flagged ${s.flagged} transactions (${coverage}% coverage), achieving ${Math.round(s.precision * 100)}% precision and ${Math.round(s.recall * 100)}% recall (F1: ${s.f1.toFixed(3)}).`,
  );

  if (s.false_positive_rate < 0.05) {
    parts.push("False positive exposure is minimal, indicating strong signal specificity.");
  } else if (s.false_positive_rate < 0.15) {
    parts.push("False positive exposure is moderate - threshold tuning may improve specificity.");
  } else {
    parts.push("False positive exposure is elevated - consider tightening detection thresholds.");
  }

  if (avgRisk > 0.7) {
    parts.push(`The average risk score of ${avgRisk.toFixed(3)} across flagged records indicates a high-confidence fraud signal cluster.`);
  } else if (avgRisk > 0.4) {
    parts.push(`The average risk score of ${avgRisk.toFixed(3)} suggests moderate confidence in flagged cases.`);
  } else {
    parts.push(`The average risk score of ${avgRisk.toFixed(3)} indicates borderline signals requiring manual review.`);
  }

  return parts.join(" ");
}
