import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRecommendations } from "../../pipelineComparison/api";
import type { SavedPipelineShape } from "../types";
import type { ExecutionSummary, Suggestion } from "../../pipelineComparison/types";

interface Props {
  pipeline: SavedPipelineShape;
  summary: ExecutionSummary;
}

/**
 * Rule-based "Suggested Optimizations" panel shown after a single pipeline run.
 * Explicitly heuristic, not an ML model — copy avoids overclaiming.
 */
export default function SuggestedOptimizations({ pipeline, summary }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecommendations(pipeline, summary)
      .then((res) => {
        if (!cancelled) setSuggestions(res.suggestions);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pipeline, summary]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-canvas-800">Suggested Optimizations</h3>
        </div>
        <p className="text-[11px] text-canvas-400 mt-1">
          Rule-based hints from your pipeline structure and results — not AI predictions.
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-6 text-center text-sm text-canvas-400">Analyzing pipeline…</div>
        ) : error ? (
          <div className="py-4 text-center text-sm text-red-600">
            Couldn't load suggestions: {error}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-6 text-center text-sm text-canvas-400">
            No optimization rules triggered — this pipeline looks well-structured for its metrics.
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => {
              const isOpen = !!expanded[s.id];
              return (
                <div key={s.id} className="rounded-lg border border-canvas-200 bg-canvas-50/40 overflow-hidden">
                  <div className="p-3">
                    <p className="text-sm font-medium text-canvas-800 leading-snug">{s.title}</p>
                    <p className="text-xs text-canvas-500 mt-1.5 leading-relaxed">{s.why}</p>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors"
                    >
                      {isOpen ? "Hide impact estimate" : "Preview Impact"}
                      <svg
                        viewBox="0 0 12 12"
                        className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 4l4 4 4-4" />
                      </svg>
                    </button>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-canvas-200 bg-amber-50/40"
                      >
                        <div className="p-3">
                          <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">
                            Estimated impact on {s.estimate.metric}
                          </p>
                          <p className="text-sm font-semibold text-amber-800 mt-1">{s.estimate.delta}</p>
                          <p className="text-[11px] text-canvas-500 mt-1.5 leading-relaxed">
                            {s.estimate.note}
                          </p>
                          <p className="text-[10px] text-canvas-400 mt-1.5 italic">
                            This is a static estimate, not a guarantee — a real re-run is needed to confirm.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
