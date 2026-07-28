import { motion } from "framer-motion";
import { useComparisonStore } from "../comparisonStore";

const PIPE_COLORS = ["#2E5AAC", "#0D9488", "#D97706"];

export default function ModelLoadingPanel() {
  const progress = useComparisonStore((s) => s.progress);

  const pipelines = Object.values(progress).sort((a, b) => a.index - b.index);

  if (pipelines.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 bg-gradient-to-r from-violet-50 via-white to-blue-50 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          Model & Joblib Artifact Loading
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
            ARTIFACT TRACE
          </span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          How each pipeline loads its serialized models (.joblib) and rule configs (.json) before execution
        </p>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pipelines.map((p, i) => {
          const color = PIPE_COLORS[i % PIPE_COLORS.length];
          const joblibFiles = p.artifacts.filter((a) => a.name.endsWith(".joblib"));
          const ruleFiles = p.artifacts.filter((a) => a.name.endsWith(".json"));
          const isRunning = p.status === "running";
          const isDone = p.status === "complete" || p.status === "failed";

          return (
            <div
              key={p.pipeline_id}
              className="rounded-xl border bg-slate-50 overflow-hidden"
              style={{ borderColor: color + "30", borderTopWidth: 3, borderTopColor: color }}
            >
              <div className="px-3 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold text-gray-800 truncate">{p.pipeline_name}</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    isDone
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : isRunning
                        ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {isDone ? "LOADED" : isRunning ? "LOADING" : "PENDING"}
                </span>
              </div>

              <div className="p-3 space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-violet-50 border border-violet-100">
                    <div className="text-lg font-black text-violet-700">{joblibFiles.length}</div>
                    <div className="text-[8px] font-semibold text-violet-600 uppercase tracking-wider">Joblib</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="text-lg font-black text-blue-700">{ruleFiles.length}</div>
                    <div className="text-[8px] font-semibold text-blue-600 uppercase tracking-wider">Rules</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <div className="text-lg font-black text-slate-700">{p.total_artifacts}</div>
                    <div className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Total</div>
                  </div>
                </div>

                {/* Joblib files list */}
                {joblibFiles.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="text-violet-500">{"\u25A0"}</span> Serialized Models (.joblib)
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {joblibFiles.map((a) => (
                        <div key={a.name} className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200 text-[10px]">
                          <span className="text-violet-400 font-mono">[model]</span>
                          <span className="text-slate-700 font-mono truncate flex-1" title={a.name}>{a.name}</span>
                          <span className="text-slate-400 font-mono shrink-0">{(a.size_bytes / 1024).toFixed(1)}KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    {isRunning ? "Scanning for pre-trained models..." : "No pre-trained models found - will train fresh"}
                  </div>
                )}

                {/* Rule config files */}
                {ruleFiles.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="text-blue-500">{"\u25A0"}</span> Rule Configs (.json)
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {ruleFiles.map((a) => (
                        <div key={a.name} className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200 text-[10px]">
                          <span className="text-blue-400 font-mono">[rules]</span>
                          <span className="text-slate-700 font-mono truncate flex-1" title={a.name}>{a.name}</span>
                          <span className="text-slate-400 font-mono shrink-0">{(a.size_bytes / 1024).toFixed(1)}KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading flow trace */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Loading Flow</div>
                  <div className="space-y-1">
                    <FlowStep
                      label="Scan artifact directory"
                      done={p.total_artifacts > 0 || isDone}
                      active={isRunning && p.total_artifacts === 0}
                    />
                    <FlowStep
                      label={`Load ${joblibFiles.length} joblib model(s)`}
                      done={joblibFiles.length > 0}
                      active={isRunning && joblibFiles.length === 0}
                    />
                    <FlowStep
                      label={`Parse ${ruleFiles.length} rule config(s)`}
                      done={ruleFiles.length > 0}
                      active={isRunning && ruleFiles.length === 0 && joblibFiles.length > 0}
                    />
                    <FlowStep
                      label="Initialize detection engine"
                      done={isDone}
                      active={isRunning && p.nodes.length > 0}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function FlowStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-emerald-100 text-emerald-600" : active ? "bg-amber-100 text-amber-500 animate-pulse" : "bg-slate-100 text-slate-300"
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
