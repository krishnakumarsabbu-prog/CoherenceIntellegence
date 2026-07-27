import { useEffect, useMemo, useRef, useState } from "react";
import { useExecutionStore } from "../executionStore";

export default function LogPanel() {
  const logs = useExecutionStore((s) => s.logs);
  const nodes = useExecutionStore((s) => s.nodes);
  const [filter, setFilter] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.node_id === filter);
  }, [logs, filter]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Terminal Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-widest pl-2 border-l border-slate-200">
            Telemetry Stream
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {filtered.length} EVENTS
          </span>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white text-slate-700 text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">⚡ All Nodes Stream</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              📍 {n.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stream Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 bg-[#F8FAFC] min-h-[140px] leading-relaxed">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-10 space-y-1">
            <span className="text-2xl">📡</span>
            <span className="font-semibold text-slate-500">Awaiting execution telemetry stream…</span>
            <span className="text-[11px] text-slate-400">Click "Run Enterprise Pipeline" to watch live execution.</span>
          </div>
        ) : (
          filtered.map((l) => {
            const isError = l.level === "error";
            const isNodeEvent = l.message.includes("Scored") || l.message.includes("Cleaned") || l.message.includes("Loaded");
            return (
              <div key={l.id} className="flex items-start gap-2.5 hover:bg-slate-200/50 p-1.5 rounded-lg transition-colors group">
                <span className="text-slate-400 shrink-0 text-[10px] font-bold">
                  [{new Date(l.ts).toLocaleTimeString()}]
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                  isError
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : isNodeEvent
                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    : "bg-slate-200 text-slate-700 border border-slate-300"
                }`}>
                  {isError ? "ERR" : isNodeEvent ? "TELEMETRY" : "INFO"}
                </span>
                <span className={`text-[11px] break-all ${
                  isError
                    ? "text-rose-700 font-semibold"
                    : isNodeEvent
                    ? "text-slate-800 font-medium"
                    : "text-slate-700"
                }`}>
                  {l.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
