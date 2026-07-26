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

  // Auto-scroll to bottom on new lines.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-canvas-800">Execution Log</h3>
          <p className="text-xs text-canvas-400 mt-0.5">Live stream of pipeline events</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input text-xs py-1.5 w-auto max-w-[160px]"
          title="Filter by node"
        >
          <option value="all">All nodes</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs space-y-1 min-h-[120px]">
        {filtered.length === 0 ? (
          <p className="text-canvas-400 italic py-4 text-center">No log entries yet. Run a pipeline to begin.</p>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="flex gap-2 leading-relaxed">
              <span className="text-canvas-400 shrink-0">{new Date(l.ts).toLocaleTimeString()}</span>
              <span className={l.level === "error" ? "text-red-600" : "text-canvas-700"}>{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
