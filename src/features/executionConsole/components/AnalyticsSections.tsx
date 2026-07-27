/**
 * Visual analytics sub-components for the redesigned Execution Console.
 * All charts use recharts with animations enabled; all motion uses framer-motion.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, animate as fmAnimate } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type {
  ExecutionResults,
  ExecutionSummary,
  FlaggedOverTimePoint,
  FlaggedRow,
} from "../types";
import type { LogLine } from "../executionStore";

/* ------------------------------------------------------------------ */
/* Animated number counter                                             */
/* ------------------------------------------------------------------ */

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function AnimatedNumber({ value, decimals = 0, suffix = "", prefix = "", className = "" }: AnimatedNumberProps) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const controls = fmAnimate(mv, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplay(latest.toFixed(decimals));
      },
    });
    return () => controls.stop();
  }, [value, decimals, mv]);

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline (axis-less mini area chart)                               */
/* ------------------------------------------------------------------ */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace("#", "")}`;
  return (
    <div className="h-9 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive
            animationDuration={1200}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MetricCard — animated KPI card                                      */
/* ------------------------------------------------------------------ */

export interface MetricCardProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  icon: string;
  accent: string; // hex
  trend?: number; // percentage change, e.g. +12.4 or -3.1
  spark: number[];
  index?: number;
}

export function MetricCard({ label, value, decimals = 0, suffix = "", prefix = "", icon, accent, trend, spark, index = 0 }: MetricCardProps) {
  const trendUp = trend != null && trend >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ scale: 1.025, transition: { duration: 0.2 } }}
      className="relative bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full" style={{ backgroundColor: accent }} />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between">
          <div className="grid place-items-center w-10 h-10 rounded-xl text-lg shadow-sm" style={{ backgroundColor: `${accent}1A`, color: accent }}>
            <span>{icon}</span>
          </div>
          {trend != null && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {trendUp ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <AnimatedNumber
          value={value}
          decimals={decimals}
          suffix={suffix}
          prefix={prefix}
          className="block mt-1 text-2xl font-black tracking-tight text-gray-900"
        />
        <div className="mt-2">
          <Sparkline data={spark} color={accent} />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton shimmer placeholder                                        */
/* ------------------------------------------------------------------ */

export function MetricCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-4 overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
        <div className="w-12 h-5 rounded-md bg-gray-100 animate-pulse" />
      </div>
      <div className="mt-3 h-3 w-20 rounded bg-gray-100 animate-pulse" />
      <div className="mt-2 h-6 w-24 rounded bg-gray-100 animate-pulse" />
      <div className="mt-3 h-9 w-full rounded bg-gray-100 animate-pulse" />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom chart tooltip                                                */
/* ------------------------------------------------------------------ */

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg ring-1 ring-gray-200 px-3.5 py-2.5 text-xs"
    >
      {label != null && <p className="font-bold text-gray-900 mb-1">{String(label)}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 capitalize">{p.name ?? p.dataKey}</span>
          <span className="ml-auto font-bold text-gray-900">{p.value}</span>
        </div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* ExecutionChart — primary performance area chart                    */
/* ------------------------------------------------------------------ */

type TimeRange = "1H" | "6H" | "24H" | "7D" | "30D";
const RANGE_SLICE: Record<TimeRange, number> = {
  "1H": 6,
  "6H": 12,
  "24H": 24,
  "7D": 30,
  "30D": 40,
};

export function ExecutionChart({ results }: { results: ExecutionResults | null }) {
  const [range, setRange] = useState<TimeRange>("24H");
  const data: FlaggedOverTimePoint[] = results?.flagged_over_time ?? [];

  const sliced = useMemo(() => {
    const n = RANGE_SLICE[range];
    return data.slice(Math.max(0, data.length - n));
  }, [data, range]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Execution Performance Over Time</h3>
          <p className="text-xs text-gray-500 mt-0.5">Flagged transactions detected across the processing window</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl ring-1 ring-gray-200">
          {(["1H", "6H", "24H", "7D", "30D"] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => setRange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === t ? "bg-white text-blue-700 shadow-sm font-bold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {sliced.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-gray-400 text-sm">
            <div className="space-y-2">
              <div className="text-3xl">📈</div>
              <p className="font-semibold text-gray-500">No performance telemetry yet</p>
              <p className="text-xs text-gray-400">Run a pipeline to populate the performance curve.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#94A3B8" }} stroke="#E2E8F0" />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} stroke="#E2E8F0" allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="flagged"
                name="Flagged"
                stroke="#2563EB"
                strokeWidth={3}
                fill="url(#perfGrad)"
                isAnimationActive
                animationDuration={1500}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Secondary charts row: BarChart + PieChart                          */
/* ------------------------------------------------------------------ */

export function SecondaryCharts({ results }: { results: ExecutionResults | null }) {
  const dist = results?.score_distribution ?? [];
  const summary = results?.summary;

  const statusData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "True Positives", value: summary.true_positives, color: "#10B981" },
      { name: "False Positives", value: summary.false_positives, color: "#F59E0B" },
      { name: "False Negatives", value: summary.false_negatives, color: "#EF4444" },
      { name: "True Negatives", value: summary.true_negatives, color: "#64748B" },
    ];
  }, [summary]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900">Score Distribution</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">Transaction count per fraud-score bucket</p>
        <div className="h-56">
          {dist.length === 0 ? (
            <div className="h-full grid place-items-center text-gray-400 text-sm">No distribution data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94A3B8" }} stroke="#E2E8F0" />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} stroke="#E2E8F0" allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F8FAFC" }} />
                <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1400}>
                  {dist.map((_, i) => (
                    <Cell key={i} fill={["#10B981", "#3B82F6", "#F59E0B", "#F97316", "#EF4444"][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Pie chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
        className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900">Status Breakdown</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">Classification outcome distribution</p>
        <div className="h-56 flex items-center">
          {statusData.length === 0 || statusData.every((s) => s.value === 0) ? (
            <div className="w-full text-center text-gray-400 text-sm">No classification data</div>
          ) : (
            <>
              <div className="h-full w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      isAnimationActive
                      animationDuration={1400}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {statusData.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2 pl-4">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600">{s.name}</span>
                    <span className="ml-auto font-bold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HistoricalTable — searchable data table with pagination            */
/* ------------------------------------------------------------------ */

const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  HIGH: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  MEDIUM: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  LOW: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
};

export function HistoricalTable({ results }: { results: ExecutionResults | null }) {
  const rows: FlaggedRow[] = results?.flagged_rows ?? [];
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.transaction_id.toLowerCase().includes(q) ||
        r.flagged_by.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        (r.fraud_reason ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const safePage = Math.min(page, totalPages - 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden"
    >
      <div className="p-5 border-b border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Flagged Transaction Ledger</h3>
            <p className="text-xs text-gray-500 mt-0.5">Searchable record of every flagged transaction</p>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search id, country, signal…"
              className="pl-9 pr-3 py-2 rounded-xl text-xs bg-gray-50 ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-200 focus:bg-white focus:outline-none transition w-64"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 sticky top-0">
            <tr>
              <th className="px-4 py-3">Transaction ID</th>
              <th className="px-4 py-3 text-center">Risk Tier</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Flagged By</th>
              <th className="px-4 py-3 text-center">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 font-sans">
                  {rows.length === 0 ? "No flagged transactions — run a pipeline to populate the ledger." : "No matches for your search."}
                </td>
              </tr>
            ) : (
              paged.map((r) => {
                const risk = r.risk_tier ?? "MEDIUM";
                const rs = RISK_STYLES[risk] ?? RISK_STYLES.MEDIUM;
                return (
                  <tr key={r.transaction_id} className="hover:bg-blue-50/40 transition-colors duration-200">
                    <td className="px-4 py-3 font-bold text-gray-800">{r.transaction_id}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rs}`}>{risk}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{r.score.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">${Number(r.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.country || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.flagged_by}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.is_fraud ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        }`}
                      >
                        {r.is_fraud ? "FRAUD" : "FALSE POS"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">
            Page {safePage + 1} of {totalPages} · {filtered.length} records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white ring-1 ring-gray-200 text-gray-700 disabled:opacity-40 hover:bg-gray-100 transition"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white ring-1 ring-gray-200 text-gray-700 disabled:opacity-40 hover:bg-gray-100 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* ActivityFeed — recent execution timeline                            */
/* ------------------------------------------------------------------ */

export function ActivityFeed({ logs, status }: { logs: LogLine[]; status: string }) {
  const recent = useMemo(() => logs.slice(-12).reverse(), [logs]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm flex flex-col max-h-[420px]"
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Activity Feed</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "running" || status === "starting"
                ? "bg-amber-500 animate-pulse"
                : status === "completed"
                ? "bg-emerald-500"
                : status === "failed"
                ? "bg-rose-500"
                : "bg-gray-300"
            }`}
          />
          {status}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {recent.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-gray-400 text-xs py-8">
            <div className="space-y-1.5">
              <div className="text-2xl">📡</div>
              <p className="font-semibold text-gray-500">No activity yet</p>
              <p className="text-[11px] text-gray-400">Run a pipeline to stream live events.</p>
            </div>
          </div>
        ) : (
          recent.map((l) => {
            const isErr = l.level === "error";
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3"
              >
                <div className="flex flex-col items-center pt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ring-4 ${
                      isErr ? "bg-rose-500 ring-rose-100" : "bg-blue-500 ring-blue-100"
                    }`}
                  />
                  <span className="w-px flex-1 bg-gray-100 mt-1" />
                </div>
                <div className="min-w-0 pb-1">
                  <p className={`text-xs leading-snug ${isErr ? "text-rose-700 font-semibold" : "text-gray-700"}`}>{l.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                    {new Date(l.ts).toLocaleTimeString()}
                    {l.node_id ? ` · ${l.node_id}` : ""}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Helper: build sparkline data from a summary value                   */
/* ------------------------------------------------------------------ */

export function buildSpark(seed: number, points = 10): number[] {
  const out: number[] = [];
  let v = seed * 0.6;
  for (let i = 0; i < points; i++) {
    const wobble = Math.sin((seed + 1) * (i + 1.7)) * seed * 0.12;
    v = Math.max(0, v + wobble + (seed * 0.04) * (i / points));
    out.push(Math.round(v * 100) / 100);
  }
  out[out.length - 1] = seed;
  return out;
}

export function buildFlaggedSpark(results: ExecutionResults | null): number[] {
  const data = results?.flagged_over_time ?? [];
  if (data.length === 0) return buildSpark(results?.summary.flagged ?? 0);
  return data.slice(-10).map((d) => d.flagged);
}

export type { ExecutionSummary };
