import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ALGORITHM_TABS,
  ALGORITHMS as FALLBACK_ALGORITHMS,
  type AlgorithmDef,
  type AlgorithmTab,
  type Complexity,
  type Stability,
  type IOType,
} from "../data/algorithms";
import { useAllAlgorithmsWithDetails } from "../features/pipelineStudio/algorithmApi";

const complexityStyles: Record<Complexity, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-rose-50 text-rose-700 border-rose-200",
};

const stabilityStyles: Record<Stability, string> = {
  Stable: "bg-emerald-50 text-emerald-700",
  Beta: "bg-accent-50 text-accent-700",
};

export default function AlgorithmLibraryPage() {
  const [activeTab, setActiveTab] = useState<AlgorithmTab>("feature-engineering");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, refetch } = useAllAlgorithmsWithDetails();

  // Normalize API data or fallback to local single-source-of-truth if backend is unreachable
  const allAlgos: AlgorithmDef[] = data?.algorithms
    ? data.algorithms.map((a) => ({
        id: a.id,
        name: a.name,
        tab: (a.category || a.tab || "feature-engineering") as AlgorithmTab,
        oneLine: a.oneLine,
        complexity: (a.complexity as Complexity) || "Medium",
        inputType: (a.inputType as IOType) || "Feature Set",
        outputType: (a.outputType as IOType) || "Scores",
        stability: (a.stability as Stability) || "Stable",
        version: a.version || "v1.0",
        advantages: a.advantages || [],
        disadvantages: a.disadvantages || [],
        parameters: a.parameters || [],
        exampleUseCase: a.exampleUseCase || "",
      }))
    : FALLBACK_ALGORITHMS;

  const isLiveBackend = Boolean(data?.algorithms && data.algorithms.length > 0);

  const tabAlgos = allAlgos.filter((a) => a.tab === activeTab);
  const filtered = query.trim()
    ? tabAlgos.filter((a) =>
        [a.name, a.oneLine, a.exampleUseCase]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : tabAlgos;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">
              Algorithm Library
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isLiveBackend
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveBackend ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {isLiveBackend ? "Backend API Live" : "Offline Mode"}
            </span>
          </div>
          <p className="text-sm text-canvas-500 mt-1">
            Browse detection and feature-engineering algorithms loaded dynamically from the backend registry (10 top algorithms per category).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search algorithms…"
            className="input sm:w-64 text-sm"
          />
          {isError && (
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-xs font-medium text-canvas-700 bg-canvas-100 hover:bg-canvas-200 rounded-md transition-colors"
            >
              Retry API
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-canvas-200">
        <nav className="flex gap-1 overflow-x-auto">
          {ALGORITHM_TABS.map((t) => {
            const active = t.id === activeTab;
            const count = allAlgos.filter((a) => a.tab === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  setExpandedId(null);
                }}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  active
                    ? "text-accent-700 font-semibold"
                    : "text-canvas-500 hover:text-canvas-800"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    active
                      ? "bg-accent-100 text-accent-800"
                      : "bg-canvas-100 text-canvas-500"
                  }`}
                >
                  {count}
                </span>
                {active && (
                  <motion.span
                    layoutId="algo-tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent-500 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab description */}
      <p className="text-sm text-canvas-500 -mt-2">
        {ALGORITHM_TABS.find((t) => t.id === activeTab)?.description}
      </p>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 py-4">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="h-48 rounded-xl border border-canvas-200 bg-canvas-50/50 p-4 animate-pulse space-y-3"
            >
              <div className="h-4 bg-canvas-200 rounded w-2/3" />
              <div className="h-3 bg-canvas-200 rounded w-full" />
              <div className="h-3 bg-canvas-200 rounded w-4/5" />
              <div className="h-6 bg-canvas-200 rounded w-1/3 mt-6" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center py-20 text-center border border-dashed border-canvas-200 rounded-xl bg-canvas-50/50">
          <p className="text-sm text-canvas-500">
            No algorithms match "{query}" in {ALGORITHM_TABS.find((t) => t.id === activeTab)?.label}.
          </p>
        </div>
      ) : (
        /* Card grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((algo, i) => (
            <AlgorithmCard
              key={algo.id}
              algo={algo}
              index={i}
              expanded={expandedId === algo.id}
              onToggle={() =>
                setExpandedId((id) => (id === algo.id ? null : algo.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlgorithmCard({
  algo,
  index,
  expanded,
  onToggle,
}: {
  algo: AlgorithmDef;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="glass-card glass-card-hover flex flex-col"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-canvas-900 leading-tight">
              {algo.name}
            </h3>
            <p className="text-xs text-canvas-500 mt-1 leading-relaxed line-clamp-2">
              {algo.oneLine}
            </p>
          </div>
          <span
            className={`badge border shrink-0 ${complexityStyles[algo.complexity] || "bg-canvas-100 text-canvas-700"}`}
          >
            {algo.complexity}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <IOChip label="in" value={algo.inputType} />
          <ArrowIcon className="w-3 h-3 text-canvas-300" />
          <IOChip label="out" value={algo.outputType} />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className={`badge ${stabilityStyles[algo.stability] || "bg-canvas-100 text-canvas-700"}`}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                algo.stability === "Stable"
                  ? "bg-emerald-500"
                  : "bg-accent-500"
              }`}
            />
            {algo.stability}
          </span>
          <span className="text-[11px] text-canvas-400 font-mono">
            {algo.version}
          </span>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="mt-auto px-4 py-2.5 border-t border-canvas-100 flex items-center justify-between text-xs font-medium text-accent-600 hover:bg-accent-50/50 transition-colors"
      >
        {expanded ? "Hide details" : "View details & parameters"}
        <ChevronIcon
          className={`w-3.5 h-3.5 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 pt-1">
              {algo.advantages && algo.advantages.length > 0 && (
                <DetailList
                  title="Advantages"
                  items={algo.advantages}
                  tone="positive"
                />
              )}

              {algo.disadvantages && algo.disadvantages.length > 0 && (
                <DetailList
                  title="Disadvantages"
                  items={algo.disadvantages}
                  tone="negative"
                />
              )}

              {algo.parameters && algo.parameters.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-canvas-500 uppercase tracking-wide mb-2">
                    Parameters ({algo.parameters.length})
                  </h4>
                  <div className="rounded-md border border-canvas-200 divide-y divide-canvas-100 bg-canvas-50/40">
                    {algo.parameters.map((p) => (
                      <div
                        key={p.name}
                        className="px-3 py-2 flex items-start gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-canvas-800 font-semibold">
                              {p.name}
                            </code>
                            <span className="text-[10px] text-canvas-500 bg-canvas-200 px-1 py-0.5 rounded font-mono">
                              {p.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-canvas-500 mt-0.5 leading-relaxed">
                            {p.hint}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-canvas-400 uppercase tracking-wide">
                            default
                          </p>
                          <code className="text-xs font-mono text-canvas-700 font-medium">
                            {String(p.default)}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {algo.exampleUseCase && (
                <div className="rounded-md bg-accent-50/60 border border-accent-100 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide mb-1">
                    Example use case
                  </p>
                  <p className="text-xs text-canvas-700 leading-relaxed">
                    {algo.exampleUseCase}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const dot = tone === "positive" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-canvas-500 uppercase tracking-wide mb-2">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`}
            />
            <p className="text-xs text-canvas-600 leading-relaxed">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IOChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-canvas-600 bg-canvas-100 border border-canvas-200 px-1.5 py-0.5 rounded font-mono">
      <span className="text-canvas-400 uppercase tracking-wide font-sans text-[10px]">{label}:</span>
      {value}
    </span>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
