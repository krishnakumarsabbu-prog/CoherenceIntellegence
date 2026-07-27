import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRecommendations } from "../../pipelineComparison/api";
import type { SavedPipelineShape } from "../types";
import type { ExecutionSummary, Suggestion } from "../../pipelineComparison/types";

interface Props {
  pipeline: SavedPipelineShape;
  summary: ExecutionSummary;
}

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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-amber-50/60 via-white to-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Executive Advisory · Architectural Optimizations</h3>
            <p className="text-xs text-slate-500">Heuristic topology analysis based on score distribution and node flow</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {suggestions.length} ADVISORIES
        </span>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="py-6 text-center text-xs font-mono text-slate-400">Analyzing pipeline topology…</div>
        ) : error ? (
          <div className="py-4 text-center text-xs text-rose-600">Couldn't load suggestions: {error}</div>
        ) : suggestions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No topology warnings triggered — this architecture is highly optimal for its current threshold.
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => {
              const isOpen = !!expanded[s.id];
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold text-slate-800 leading-snug">{s.title}</p>
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors shrink-0"
                      >
                        {isOpen ? "Hide Impact" : "Preview Impact"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{s.why}</p>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-slate-200 bg-amber-50/50 p-4 space-y-1.5"
                      >
                        <div className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
                          ESTIMATED METRIC IMPACT: {s.estimate.metric}
                        </div>
                        <p className="text-sm font-black text-amber-900">{s.estimate.delta}</p>
                        <p className="text-xs text-slate-700">{s.estimate.note}</p>
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
