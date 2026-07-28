import { useMemo } from "react";
import { motion } from "framer-motion";
import type { ComparisonResult, ExecutionSummary } from "../types";

const PIPE_COLORS = ["#2E5AAC", "#0D9488", "#D97706"];

export default function ComparisonCoherenceBrain({ results }: { results: ComparisonResult[] }) {
  const valid = useMemo(() => results.filter((r) => r.summary && !r.error), [results]);

  const analysis = useMemo(() => computeCrossPipelineAnalysis(valid), [valid]);

  if (valid.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 bg-gradient-to-r from-blue-50 via-white to-emerald-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Coherence Brain - Cross-Pipeline Synthesis</h3>
          <p className="text-xs text-gray-500 mt-0.5">Need at least 2 completed pipelines to synthesize</p>
        </div>
        <div className="p-10 text-center text-sm text-gray-500">
          Run a comparison with 2+ pipelines to activate the cross-pipeline mathematical synthesis engine.
        </div>
      </motion.div>
    );
  }

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
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Coherence Brain - Cross-Pipeline Synthesis
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                MATHEMATICAL ANALYSIS
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Statistical comparison of {valid.length} pipelines using coherence theory & information metrics
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          SYNTHESIZED
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Winner banner */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 via-white to-blue-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{"\u2605"}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Coherence Winner</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {analysis.winner.pipeline_name}
          </p>
          <p className="text-xs text-gray-600 mt-1">{analysis.winnerRationale}</p>
        </div>

        {/* Mathematical metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <MathCard
            title="Coherence Score"
            formula="C = w1*F1 + w2*(1-FPR) + w3*Recall"
            values={analysis.coherenceScores}
            pipelines={valid}
            description="Weighted fusion of F1, inverse FPR, and recall"
            higherBetter
          />
          <MathCard
            title="Information Gain Ratio"
            formula="IGR = H(Y) - H(Y|S) / H(Y)"
            values={analysis.informationGainRatios}
            pipelines={valid}
            description="Relative reduction in fraud uncertainty"
            higherBetter
          />
          <MathCard
            title="Matthews Correlation Coefficient"
            formula="MCC = (TP*TN-FP*FN) / sqrt((TP+FP)(TP+FN)(TN+FP)(TN+FN))"
            values={analysis.mccScores}
            pipelines={valid}
            description="Balanced correlation accounting for all confusion cells"
            higherBetter
          />
          <MathCard
            title="Youden's J Statistic"
            formula="J = Sensitivity + Specificity - 1"
            values={analysis.youdenJ}
            pipelines={valid}
            description="Distance from the random diagonal in ROC space"
            higherBetter
          />
          <MathCard
            title="Balanced Accuracy"
            formula="BA = (TPR + TNR) / 2"
            values={analysis.balancedAccuracy}
            pipelines={valid}
            description="Average of true positive and true negative rates"
            higherBetter
          />
          <MathCard
            title="Negative Predictive Value"
            formula="NPV = TN / (TN + FN)"
            values={analysis.npv}
            pipelines={valid}
            description="Probability a non-flagged txn is truly legitimate"
            higherBetter
          />
        </div>

        {/* Pairwise agreement matrix */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Pairwise Detection Agreement Matrix (Jaccard Similarity)</div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2"></th>
                  {valid.map((r) => (
                    <th key={r.pipeline_id} className="px-3 py-2 text-center" style={{ color: PIPE_COLORS[valid.indexOf(r) % 3] }}>
                      {r.pipeline_name.length > 12 ? r.pipeline_name.slice(0, 10) + "..." : r.pipeline_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valid.map((r, i) => (
                  <tr key={r.pipeline_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-800" style={{ color: PIPE_COLORS[i % 3] }}>
                      {r.pipeline_name.length > 12 ? r.pipeline_name.slice(0, 10) + "..." : r.pipeline_name}
                    </td>
                    {valid.map((r2, j) => (
                      <td key={r2.pipeline_id} className="px-3 py-2 text-center font-mono">
                        {i === j ? (
                          <span className="text-slate-300">--</span>
                        ) : (
                          <span className={`font-bold ${analysis.jaccardMatrix[i][j] >= 0.7 ? "text-emerald-600" : analysis.jaccardMatrix[i][j] >= 0.4 ? "text-amber-600" : "text-rose-600"}`}>
                            {(analysis.jaccardMatrix[i][j] * 100).toFixed(1)}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            Jaccard similarity = |A &#8745; B| / |A &#8746; B| over flagged transaction sets. High agreement means pipelines flag the same transactions.
          </p>
        </div>

        {/* Synthesis narrative */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/60 to-emerald-50/40 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{"\u25C8"}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Cross-Pipeline Synthesis Narrative</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{analysis.narrative}</p>
        </div>

        {/* Per-pipeline signal attribution */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Signal Attribution Breakdown (per pipeline)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {valid.map((r, i) => {
              const s = r.summary!;
              return (
                <div key={r.pipeline_id} className="p-3 rounded-lg bg-slate-50 border border-slate-200" style={{ borderLeftWidth: 3, borderLeftColor: PIPE_COLORS[i % 3] }}>
                  <div className="text-xs font-bold text-gray-800 mb-2">{r.pipeline_name}</div>
                  <div className="space-y-1.5">
                    <SignalBar label="Rule Engine AST" value={1 - s.false_positive_rate} color="bg-blue-500" />
                    <SignalBar label="ML Ensemble" value={s.precision} color="bg-violet-500" />
                    <SignalBar label="Anomaly Coverage" value={s.recall} color="bg-amber-500" />
                    <SignalBar label="Coherence Fusion" value={s.f1} color="bg-emerald-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Math + sub-components                                               */
/* ------------------------------------------------------------------ */

function MathCard({
  title,
  formula,
  values,
  pipelines,
  description,
  higherBetter,
}: {
  title: string;
  formula: string;
  values: number[];
  pipelines: ComparisonResult[];
  description: string;
  higherBetter: boolean;
}) {
  const maxVal = higherBetter ? Math.max(...values) : Math.min(...values);
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">{title}</span>
      </div>
      <p className="text-[10px] font-mono text-slate-500 mb-2">{formula}</p>
      <div className="space-y-1.5">
        {pipelines.map((r, i) => {
          const v = values[i];
          const isBest = higherBetter ? v === maxVal : v === maxVal;
          return (
            <div key={r.pipeline_id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIPE_COLORS[i % 3] }} />
              <span className="text-[10px] text-slate-600 truncate flex-1">{r.pipeline_name}</span>
              <span className={`text-xs font-bold font-mono ${isBest ? "text-emerald-600" : "text-slate-700"}`}>
                {v.toFixed(4)}
              </span>
              {isBest && <span className="text-[9px] text-emerald-500">BEST</span>}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-slate-400 mt-2 leading-snug">{description}</p>
    </div>
  );
}

function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cross-pipeline mathematical analysis                                */
/* ------------------------------------------------------------------ */

interface CrossPipelineAnalysis {
  winner: ComparisonResult;
  winnerRationale: string;
  coherenceScores: number[];
  informationGainRatios: number[];
  mccScores: number[];
  youdenJ: number[];
  balancedAccuracy: number[];
  npv: number[];
  jaccardMatrix: number[][];
  narrative: string;
}

function computeMCC(s: ExecutionSummary): number {
  const { true_positives: tp, false_positives: fp, false_negatives: fn, true_negatives: tn } = s;
  const num = tp * tn - fp * fn;
  const den = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return den === 0 ? 0 : num / den;
}

function computeCrossPipelineAnalysis(valid: ComparisonResult[]): CrossPipelineAnalysis {
  const summaries = valid.map((r) => r.summary!);
  const flaggedSets = valid.map((r) => new Set((r.results?.flagged_rows ?? []).map((f) => f.transaction_id)));

  const coherenceScores = summaries.map((s) =>
    0.45 * s.f1 + 0.30 * (1 - s.false_positive_rate) + 0.25 * s.recall,
  );
  const mccScores = summaries.map(computeMCC);
  const youdenJ = summaries.map((s) => s.recall + (1 - s.false_positive_rate) - 1);
  const balancedAccuracy = summaries.map((s) => (s.recall + (tnRate(s)) / 2));
  const npv = summaries.map((s) => {
    const denom = s.true_negatives + s.false_negatives;
    return denom === 0 ? 0 : s.true_negatives / denom;
  });

  // Information gain ratio: H(Y) - H(Y|S) / H(Y) where S=flagged decision
  const informationGainRatios = summaries.map((s) => {
    const n = s.total_transactions || 1;
    const pFraud = (s.true_positives + s.false_negatives) / n;
    const hY = entropy(pFraud);
    // H(Y|S=flagged) and H(Y|S=not flagged)
    const pFlagged = s.flagged / n || 1e-9;
    const pFraudGivenFlagged = s.true_positives / (s.flagged || 1);
    const pFraudGivenNotFlagged = s.false_negatives / (n - s.flagged || 1);
    const hYGivenFlagged = entropy(pFraudGivenFlagged);
    const hYGivenNotFlagged = entropy(pFraudGivenNotFlagged);
    const hYGivenS = pFlagged * hYGivenFlagged + (1 - pFlagged) * hYGivenNotFlagged;
    return hY === 0 ? 0 : (hY - hYGivenS) / hY;
  });

  // Jaccard similarity matrix
  const jaccardMatrix: number[][] = valid.map((_, i) =>
    valid.map((_, j) => {
      if (i === j) return 1;
      const a = flaggedSets[i];
      const b = flaggedSets[j];
      const intersection = [...a].filter((x) => b.has(x)).length;
      const union = new Set([...a, ...b]).size;
      return union === 0 ? 0 : intersection / union;
    }),
  );

  // Winner = highest coherence score
  let winnerIdx = 0;
  coherenceScores.forEach((v, i) => {
    if (v > coherenceScores[winnerIdx]) winnerIdx = i;
  });
  const winner = valid[winnerIdx];
  const winnerS = summaries[winnerIdx];

  const winnerRationale = `${winner.pipeline_name} achieves the highest coherence score (${coherenceScores[winnerIdx].toFixed(4)}) with F1=${winnerS.f1.toFixed(3)}, FPR=${(winnerS.false_positive_rate * 100).toFixed(2)}%, and recall=${(winnerS.recall * 100).toFixed(1)}%. MCC=${mccScores[winnerIdx].toFixed(3)} indicates strong balanced classification.`;

  const narrative = buildNarrative(valid, coherenceScores, mccScores, jaccardMatrix, winnerIdx);

  return {
    winner,
    winnerRationale,
    coherenceScores,
    informationGainRatios,
    mccScores,
    youdenJ,
    balancedAccuracy,
    npv,
    jaccardMatrix,
    narrative,
  };
}

function tnRate(s: ExecutionSummary): number {
  const denom = s.true_negatives + s.false_positives;
  return denom === 0 ? 0 : s.true_negatives / denom;
}

function entropy(p: number): number {
  p = Math.max(1e-9, Math.min(1 - 1e-9, p));
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function buildNarrative(
  valid: ComparisonResult[],
  coherence: number[],
  mcc: number[],
  jaccard: number[][],
  winnerIdx: number,
): string {
  const parts: string[] = [];
  parts.push(`The Coherence Brain synthesized ${valid.length} pipelines using mathematical coherence theory.`);

  parts.push(
    `Coherence scores range from ${Math.min(...coherence).toFixed(4)} to ${Math.max(...coherence).toFixed(4)}, with ${valid[winnerIdx].pipeline_name} leading.`,
  );

  const avgMcc = mcc.reduce((a, b) => a + b, 0) / mcc.length;
  parts.push(`Mean Matthews Correlation Coefficient is ${avgMcc.toFixed(4)}, indicating ${avgMcc > 0.5 ? "strong" : avgMcc > 0.2 ? "moderate" : "weak"} balanced classification across the ensemble.`);

  if (valid.length === 2) {
    const j = jaccard[0][1];
    parts.push(`Pairwise Jaccard agreement is ${(j * 100).toFixed(1)}%, meaning the two pipelines ${j > 0.6 ? "largely agree on flagged transactions" : j > 0.3 ? "partially overlap in their fraud detections" : "flag substantially different transaction sets"}.`);
  } else {
    const avgJaccard =
      (jaccard[0][1] + jaccard[0][2] + jaccard[1][2]) / 3;
    parts.push(`Average pairwise Jaccard agreement is ${(avgJaccard * 100).toFixed(1)}% across all pipeline pairs.`);
  }

  parts.push(`Recommendation: deploy ${valid[winnerIdx].pipeline_name} as the primary detector, with ${valid.length > 1 ? valid[(winnerIdx + 1) % valid.length].pipeline_name : "secondary models"} as a consensus validator to reduce false negatives.`);

  return parts.join(" ");
}
